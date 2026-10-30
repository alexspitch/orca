import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  BuildWebIssueRow,
  BuildWebIssueSort,
  BuildWebProduct,
  BuildWebStatus
} from '../../../../src/shared/build-web-types'
import {
  nextSort,
  readViewPrefs,
  writeViewPrefs,
  QUICK_FILTERS,
  type IssueSortState,
  type QuickFilter
} from '../../../../src/renderer/src/components/build-web/build-web-view-prefs'
import { buildWebErrorMessage } from '../build-web-operations'
import { useBuildWebScreen } from '../build-web-screen-context'
import {
  ISSUE_PAGE_SIZE,
  OPEN_STATUSES,
  issueQueryOf,
  type BuildWebListFilters
} from './issue-list-query'
import { listIssuesRefusal } from './list-capability-gates'

// The desktop build-web-store and use-build-web-data for one mounted list: filters, sort, page,
// rows, selection and folds. The view prefs persist exactly as the desktop's do.

const SEARCH_DEBOUNCE_MS = 300

export type IssueList = ReturnType<typeof useIssueList>

function withToggled<T>(set: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(set)
  if (!next.delete(value)) {
    next.add(value)
  }
  return next
}

export function useIssueList(reloadToken: number) {
  const { call, hostCapabilities } = useBuildWebScreen()
  const [prefs] = useState(readViewPrefs)
  const [quick, setQuick] = useState<ReadonlySet<QuickFilter>>(() => new Set(prefs.quick))
  const [statuses, setStatusSet] = useState<ReadonlySet<BuildWebStatus>>(
    () => new Set(prefs.statuses ?? OPEN_STATUSES)
  )
  const [products, setProductSet] = useState<ReadonlySet<BuildWebProduct>>(() => new Set())
  const [assignees, setAssigneeSet] = useState<ReadonlySet<string>>(() => new Set())
  const [query, setQueryState] = useState('')
  const [sort, setSort] = useState<IssueSortState>(prefs.sort)
  const [page, setPageState] = useState(0)
  /** The saved query whose tab the list is; null for the plain List, whose filters are kept. */
  const [queryTabId, setQueryTabId] = useState<string | null>(null)
  const [issues, setIssueRows] = useState<BuildWebIssueRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [foldAll, setFoldAllState] = useState(prefs.foldAll)
  const [toggled, setToggled] = useState<readonly string[]>(prefs.folded)
  const generation = useRef(0)

  const toggleQuick = useCallback(
    (filter: QuickFilter) => {
      setQuick((current) => {
        const next = new Set(current)
        if (!next.delete(filter)) {
          next.add(filter)
        }
        // Why the archive is not kept: a restart must land on the live tasks, not on put-away ones.
        if (queryTabId === null) {
          writeViewPrefs({ quick: [...next].filter((q) => q !== 'archived') })
        }
        return next
      })
      setPageState(0)
    },
    [queryTabId]
  )

  const setStatuses = useCallback(
    (list: readonly BuildWebStatus[]) => {
      if (queryTabId === null) {
        writeViewPrefs({ statuses: [...list] })
      }
      setStatusSet(new Set(list))
      setPageState(0)
    },
    [queryTabId]
  )

  const toggleStatus = useCallback(
    (status: BuildWebStatus) => {
      const next = new Set(statuses)
      if (!next.delete(status)) {
        next.add(status)
      }
      setStatuses([...next])
    },
    [setStatuses, statuses]
  )

  const setProducts = useCallback((list: readonly BuildWebProduct[]) => {
    setProductSet(new Set(list))
    setPageState(0)
  }, [])

  const toggleProduct = useCallback((product: BuildWebProduct) => {
    setProductSet((current) => withToggled(current, product))
    setPageState(0)
  }, [])

  const setAssignees = useCallback((list: readonly string[]) => {
    setAssigneeSet(new Set(list))
    setPageState(0)
  }, [])

  const toggleAssignee = useCallback((assignee: string) => {
    setAssigneeSet((current) => withToggled(current, assignee))
    setPageState(0)
  }, [])

  // Why page 0: a narrower filter may have fewer pages than the one being read.
  const setQuery = useCallback((next: string) => {
    setQueryState(next)
    setPageState(0)
  }, [])

  const sortBy = useCallback((by: BuildWebIssueSort) => {
    setSort((current) => {
      const next = nextSort(current, by)
      writeViewPrefs({ sort: next })
      return next
    })
    setPageState(0)
  }, [])

  const setPage = useCallback((next: number) => setPageState(Math.max(0, next)), [])

  /** The list as one of its tabs: the plain List or a saved query's, each with its own filters. */
  const showListTab = useCallback((id: string | null, filters: BuildWebListFilters) => {
    setQueryTabId(id)
    setQuick(new Set(filters.quick))
    setStatusSet(new Set(filters.statuses))
    setProductSet(new Set(filters.products))
    setAssigneeSet(new Set(filters.assignees))
    setQueryState(filters.query)
    setPageState(0)
  }, [])

  const filters = useMemo<BuildWebListFilters>(
    () => ({
      quick: QUICK_FILTERS.filter((q) => quick.has(q)),
      statuses: [...statuses],
      products: [...products],
      assignees: [...assignees],
      query
    }),
    [assignees, products, query, quick, statuses]
  )

  const load = useCallback(async () => {
    const mine = ++generation.current
    const request = issueQueryOf({ quick, statuses, products, assignees, query, sort, page })
    const refusal = listIssuesRefusal(hostCapabilities, request)
    if (refusal) {
      setLoading(false)
      setError(refusal)
      return
    }
    setLoading(true)
    try {
      const answer = await call('listIssues', request)
      if (mine !== generation.current) {
        return
      }
      // Why: a selection must not hold tasks the list no longer shows — Take to work would send them.
      const shown = new Set(answer.issues.map((issue) => issue.id))
      setSelected((current) => new Set([...current].filter((id) => shown.has(id))))
      // Why: a page past the end (the list shrank) would read as «nothing matches».
      if (answer.issues.length === 0 && page > 0 && answer.total > 0) {
        setPageState(Math.ceil(answer.total / ISSUE_PAGE_SIZE) - 1)
      }
      setIssueRows(answer.issues)
      setTotal(answer.total)
      setError(null)
      setLoading(false)
    } catch (failure) {
      if (mine === generation.current) {
        setError(buildWebErrorMessage(failure))
        setLoading(false)
      }
    }
  }, [assignees, call, hostCapabilities, page, products, query, quick, sort, statuses])

  useEffect(() => {
    const timer = setTimeout(() => void load(), query ? SEARCH_DEBOUNCE_MS : 0)
    return () => clearTimeout(timer)
  }, [load, query, reloadToken])

  const patchIssue = useCallback((id: string, patch: Partial<BuildWebIssueRow>) => {
    setIssueRows((rows) => rows.map((issue) => (issue.id === id ? { ...issue, ...patch } : issue)))
  }, [])

  const dropIssue = useCallback(
    (id: string) => {
      if (!issues.some((issue) => issue.id === id)) {
        return
      }
      setIssueRows((rows) => rows.filter((issue) => issue.id !== id))
      setTotal((count) => Math.max(0, count - 1))
      setSelected((current) => new Set([...current].filter((picked) => picked !== id)))
    },
    [issues]
  )
  const reload = useCallback(() => void load(), [load])

  const toggleSelected = useCallback((id: string) => {
    setSelected((current) => {
      const next = new Set(current)
      if (!next.delete(id)) {
        next.add(id)
      }
      return next
    })
  }, [])
  const clearSelection = useCallback(() => setSelected(new Set()), [])

  const toggleFamily = useCallback((id: string) => {
    setToggled((current) => {
      const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
      writeViewPrefs({ folded: next })
      return next
    })
  }, [])
  const setFoldAll = useCallback((on: boolean) => {
    writeViewPrefs({ foldAll: on, folded: [] })
    setFoldAllState(on)
    setToggled([])
  }, [])

  return {
    quick,
    statuses,
    products,
    assignees,
    query,
    sort,
    page,
    queryTabId,
    filters,
    issues,
    total,
    loading,
    error,
    selected,
    foldAll,
    toggled,
    toggleQuick,
    setStatuses,
    toggleStatus,
    setProducts,
    toggleProduct,
    setAssignees,
    toggleAssignee,
    setQuery,
    sortBy,
    setPage,
    showListTab,
    reload,
    patchIssue,
    dropIssue,
    toggleSelected,
    clearSelection,
    toggleFamily,
    setFoldAll
  }
}
