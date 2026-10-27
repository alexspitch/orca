import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  BuildWebImageHistory,
  BuildWebImageHistoryArgs,
  BuildWebImagePage,
  BuildWebImagePageArgs,
  BuildWebImageSort
} from '../../../../src/shared/build-web-image-types'
import { buildWebErrorMessage } from '../build-web-operations'
import { useBuildWebScreen } from '../build-web-screen-context'

// The desktop's use-build-web-images: one page of an image view, read by the host from the console.

export const IMAGE_PAGE_SIZE = 50
const SEARCH_DEBOUNCE_MS = 300

export type ImageQuery<T> = {
  data: T | null
  loading: boolean
  error: string | null
  reload: (refresh?: boolean) => void
}

/** Replies to an older request are dropped; a failed re-read keeps the page already shown. */
function useImageQuery<A extends { q?: string }, T>(
  args: A,
  reloadToken: number,
  fetch: (args: A & { refresh?: boolean }) => Promise<T>
): ImageQuery<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const generation = useRef(0)
  const key = JSON.stringify(args)
  const argsRef = useRef(args)
  argsRef.current = args

  const load = useCallback(
    async (refresh = false) => {
      const mine = ++generation.current
      setLoading(true)
      try {
        const next = await fetch({ ...argsRef.current, refresh })
        if (mine === generation.current) {
          setData(next)
          setError(null)
        }
      } catch (failure) {
        if (mine === generation.current) {
          setError(buildWebErrorMessage(failure))
        }
      } finally {
        if (mine === generation.current) {
          setLoading(false)
        }
      }
    },
    [key, fetch]
  )

  const q = args.q
  // The header's Refresh moves the token: that read goes past the host's cached copy.
  const lastToken = useRef(reloadToken)
  useEffect(() => {
    const refresh = lastToken.current !== reloadToken
    lastToken.current = reloadToken
    const timer = setTimeout(() => void load(refresh), q && !refresh ? SEARCH_DEBOUNCE_MS : 0)
    return () => clearTimeout(timer)
  }, [load, q, reloadToken])

  const reload = useCallback((refresh?: boolean) => void load(refresh), [load])
  return { data, loading, error, reload }
}

export function useImagePage(
  args: BuildWebImagePageArgs,
  reloadToken: number
): ImageQuery<BuildWebImagePage> {
  const { call } = useBuildWebScreen()
  const fetch = useCallback(
    (a: BuildWebImagePageArgs & { refresh?: boolean }) => call('listImages', a),
    [call]
  )
  return useImageQuery(args, reloadToken, fetch)
}

export function useImageHistory(
  args: BuildWebImageHistoryArgs,
  reloadToken: number
): ImageQuery<BuildWebImageHistory> {
  const { call } = useBuildWebScreen()
  const fetch = useCallback(
    (a: BuildWebImageHistoryArgs & { refresh?: boolean }) => call('listImageBuilds', a),
    [call]
  )
  return useImageQuery(args, reloadToken, fetch)
}

/** Add or remove one value of a multi-select filter. */
export function toggled<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

export type ImageSorting = {
  sort: BuildWebImageSort | null
  dir: 'asc' | 'desc'
  onSort: (sort: BuildWebImageSort) => void
}

/** Unsorted until a column is picked; the same column again turns the order around. */
export function useImageSort(onChange: () => void): ImageSorting {
  const [state, setState] = useState<{ sort: BuildWebImageSort | null; dir: 'asc' | 'desc' }>({
    sort: null,
    dir: 'asc'
  })
  const onSort = (sort: BuildWebImageSort) => {
    setState((current) =>
      current.sort === sort
        ? { sort, dir: current.dir === 'asc' ? 'desc' : 'asc' }
        : // Newest first on the first pick; for status and registry, ascending puts what needs
          // attention (failed, not pushed) on top.
          { sort, dir: sort === 'at' ? 'desc' : 'asc' }
    )
    onChange()
  }
  return { ...state, onSort }
}

// Why: builds going on the console show their outcome without a manual refresh.
const RUNNING_REFRESH_MS = 20_000
// Why ten seconds at most: the table's registry and status must follow a push while it goes.
const PUSHING_REFRESH_MS = 8_000
// Why again: a table read in the same moment the console writes the flags shows the old ones.
const SETTLE_AGAIN_MS = 3000

/** Re-reads a table while a build it shows or a push is going, and each time a push ends. */
export function useImageTableFollows(
  reload: (refresh?: boolean) => void,
  follow: { running: boolean; pushing: boolean; pushSettles: number; active: boolean }
): void {
  const { running, pushing, pushSettles, active } = follow
  const reloadRef = useRef(reload)
  reloadRef.current = reload
  const first = useRef(pushSettles)
  useEffect(() => {
    if (pushSettles === first.current) {
      return
    }
    reloadRef.current(true)
    const again = setTimeout(() => reloadRef.current(true), SETTLE_AGAIN_MS)
    return () => clearTimeout(again)
  }, [pushSettles])
  const every = !active ? null : pushing ? PUSHING_REFRESH_MS : running ? RUNNING_REFRESH_MS : null
  useEffect(() => {
    if (every === null) {
      return
    }
    const timer = setInterval(() => reloadRef.current(true), every)
    return () => clearInterval(timer)
  }, [every])
}
