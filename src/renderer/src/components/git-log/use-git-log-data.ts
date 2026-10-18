import { useCallback, useEffect, useRef, useState } from 'react'
import type { GitHistoryItem, GitHistoryItemRef } from '../../../../shared/git-history'
import { errorMessage } from '../../../../shared/error-message'
import { GIT_LOG_PAGE_MAX_LOADED, type GitRefsResult } from '../../../../shared/git-log-page-types'
import type { RuntimeGitContext } from '@/runtime/runtime-git-client-context'
import { loadGitLogPage, loadGitRefs, type GitLogUnsupportedReason } from './git-log-client'
import { gitLogQueryOf, type GitLogFilters } from './git-log-filters'
import {
  cacheGitLog,
  cacheGitRefs,
  getCachedGitLog,
  getCachedGitRefs,
  gitLogFingerprint
} from './git-log-cache'

export const GIT_LOG_PAGE_SIZE = 300

export type GitLogRows = {
  items: GitHistoryItem[]
  currentRef?: GitHistoryItemRef
  hasMore: boolean
  /** Stopped at GIT_LOG_PAGE_MAX_LOADED with older commits still to come. */
  capped: boolean
  /** Set when only HEAD's history could be read, and why. */
  headOnly: GitLogUnsupportedReason | null
  nextSkip: number
}

type LogState = {
  loading: boolean
  /** The load in flight is the next page, not a fresh first page. */
  loadingMore: boolean
  /** The query these rows answer; a failed load keeps them only for the same query. */
  key: string
  rows: GitLogRows | null
  error: string | null
}

type RefsLoad = {
  /** The context these refs belong to. */
  key: string
  loading: boolean
  data: GitRefsResult | null
  error: string | null
  /** Set when the host can't list refs, and why. */
  unsupported: GitLogUnsupportedReason | null
}

export type GitLogData = {
  log: LogState
  refs: RefsLoad
  loadMore: () => void
  refresh: () => void
}

function contextKeyOf(context: RuntimeGitContext | null): string {
  if (!context) {
    return ''
  }
  const target =
    context.target.kind === 'environment' ? `env:${context.target.environmentId}` : 'local'
  return `${target}|${context.worktreeId ?? ''}`
}

function cachedLogState(queryKey: string): LogState {
  const cached = getCachedGitLog(queryKey)
  return {
    loading: !cached,
    loadingMore: false,
    key: queryKey,
    rows: cached?.rows ?? null,
    error: null
  }
}

function cachedRefsState(contextKey: string): RefsLoad {
  const cached = getCachedGitRefs(contextKey)
  return {
    key: contextKey,
    loading: true,
    data: cached?.data ?? null,
    error: null,
    unsupported: cached?.unsupported ?? null
  }
}

/**
 * The picked worktree's all-branch log, a page at a time, and its refs. A log read before is shown
 * from the cache at once and read again only when the refs say the repository moved (a checkout,
 * commit, fetch or rebase), on Refresh, or for a new pick or filter. The refs are re-read on
 * opening, when the worktree's HEAD or branch moves (`headKey`), and when the window regains focus.
 */
export function useGitLogData(
  context: RuntimeGitContext | null,
  filters: GitLogFilters,
  headKey: string
): GitLogData {
  const contextKey = contextKeyOf(context)
  const queryKey = `${contextKey}|${JSON.stringify(filters)}`
  const [refreshTick, setRefreshTick] = useState(0)
  const [focusTick, setFocusTick] = useState(0)
  const [log, setLog] = useState<LogState>(() => cachedLogState(queryKey))
  const [refs, setRefs] = useState<RefsLoad>(() => cachedRefsState(contextKey))
  const [print, setPrint] = useState<{ key: string; value: string } | null>(null)
  const fingerprint = print?.key === contextKey ? print.value : null
  const fingerprintRef = useRef(fingerprint)
  fingerprintRef.current = fingerprint
  // Why a generation: a page that lands after the query changed belongs to the old list.
  const generation = useRef(0)
  const inflight = useRef<string | null>(null)
  const handledRefresh = useRef(refreshTick)
  const latest = useRef({ context, filters, log, queryKey })
  latest.current = { context, filters, log, queryKey }

  // Someone may commit or fetch outside Orca; coming back to the window checks again.
  useEffect(() => {
    const onFocus = () => setFocusTick((tick) => tick + 1)
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  useEffect(() => {
    if (!context) {
      setRefs({ key: contextKey, loading: false, data: null, error: null, unsupported: null })
      return
    }
    let stale = false
    setRefs((current) =>
      current.key === contextKey
        ? { ...current, loading: true, error: null }
        : cachedRefsState(contextKey)
    )
    loadGitRefs(context).then(
      (result) => {
        if (stale) {
          return
        }
        const entry =
          'unsupported' in result
            ? { data: null, unsupported: result.unsupported }
            : { data: result, unsupported: null }
        cacheGitRefs(contextKey, entry)
        setRefs({ key: contextKey, loading: false, error: null, ...entry })
        setPrint({ key: contextKey, value: gitLogFingerprint(entry.data, headKey) })
      },
      (error: unknown) =>
        !stale && setRefs((current) => ({ ...current, loading: false, error: errorMessage(error) }))
    )
    return () => {
      stale = true
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- contextKey covers context
  }, [contextKey, refreshTick, headKey, focusTick])

  useEffect(() => {
    if (!context) {
      generation.current += 1
      inflight.current = null
      setLog({ loading: false, loadingMore: false, key: queryKey, rows: null, error: null })
      return
    }
    const forced = refreshTick !== handledRefresh.current
    handledRefresh.current = refreshTick
    if (!forced && inflight.current === queryKey) {
      // The first page for this query is on its way; it records the newest fingerprint.
      return
    }
    const cached = getCachedGitLog(queryKey)
    if (cached && !forced) {
      if (cached.fingerprint === null && fingerprint !== null) {
        // Its first page landed before the ref list did.
        cached.fingerprint = fingerprint
      }
      setLog((current) =>
        current.key === queryKey && current.rows === cached.rows && !current.error
          ? current
          : { loading: false, loadingMore: false, key: queryKey, rows: cached.rows, error: null }
      )
      if (fingerprint === null || cached.fingerprint === fingerprint) {
        // Why: a first page still loading for the previous query must not land over these rows.
        if (inflight.current !== null) {
          generation.current += 1
          inflight.current = null
        }
        return
      }
    }
    const gen = ++generation.current
    inflight.current = queryKey
    // Cached rows stay on screen, dimmed, while the fresh first page loads.
    setLog((current) =>
      current.key === queryKey
        ? { ...current, loading: true, loadingMore: false, error: null }
        : { loading: true, loadingMore: false, key: queryKey, rows: null, error: null }
    )
    loadGitLogPage(context, gitLogQueryOf(filters, GIT_LOG_PAGE_SIZE, 0)).then(
      (page) => {
        if (gen !== generation.current) {
          return
        }
        inflight.current = null
        const rows: GitLogRows = {
          items: page.items,
          currentRef: page.currentRef,
          hasMore: page.hasMore,
          capped: false,
          headOnly: page.headOnly,
          nextSkip: page.nextSkip
        }
        cacheGitLog(queryKey, { fingerprint: fingerprintRef.current, rows })
        setLog({ loading: false, loadingMore: false, key: queryKey, error: null, rows })
      },
      (error: unknown) => {
        if (gen !== generation.current) {
          return
        }
        inflight.current = null
        setLog((current) => ({
          loading: false,
          loadingMore: false,
          key: queryKey,
          rows: current.key === queryKey ? current.rows : null,
          error: errorMessage(error)
        }))
      }
    )
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- queryKey covers context and filters
  }, [queryKey, fingerprint, refreshTick])

  const loadMore = useCallback(() => {
    const { context: target, filters: current, log: state, queryKey: key } = latest.current
    const rows = state.rows
    if (!target || !rows || state.loading || state.key !== key || !rows.hasMore || rows.capped) {
      return
    }
    if (rows.items.length >= GIT_LOG_PAGE_MAX_LOADED) {
      setLog((now) => (now.rows ? { ...now, rows: { ...now.rows, capped: true } } : now))
      return
    }
    const gen = generation.current
    setLog((now) => ({ ...now, loading: true, loadingMore: true, error: null }))
    loadGitLogPage(target, gitLogQueryOf(current, GIT_LOG_PAGE_SIZE, rows.nextSkip)).then(
      (page) => {
        if (gen !== generation.current) {
          return
        }
        // Why also by key: the rows on screen may answer another query by now.
        const previous = latest.current.log.key === key ? latest.current.log.rows : null
        if (!previous) {
          setLog((now) => ({ ...now, loading: false, loadingMore: false }))
          return
        }
        const seen = new Set(previous.items.map((item) => item.id))
        const items = [...previous.items, ...page.items.filter((item) => !seen.has(item.id))]
        const next: GitLogRows = {
          ...previous,
          items,
          hasMore: page.hasMore,
          capped: page.hasMore && items.length >= GIT_LOG_PAGE_MAX_LOADED,
          nextSkip: page.nextSkip
        }
        cacheGitLog(key, {
          fingerprint: getCachedGitLog(key)?.fingerprint ?? fingerprintRef.current,
          rows: next
        })
        setLog((now) => ({ ...now, loading: false, loadingMore: false, rows: next }))
      },
      (error: unknown) =>
        gen === generation.current &&
        setLog((now) => ({
          ...now,
          loading: false,
          loadingMore: false,
          error: errorMessage(error)
        }))
    )
  }, [])

  const refresh = useCallback(() => setRefreshTick((tick) => tick + 1), [])

  return { log, refs, loadMore, refresh }
}
