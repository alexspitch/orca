import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  BuildWebImageHistory,
  BuildWebImageHistoryArgs,
  BuildWebImagePage,
  BuildWebImagePageArgs,
  BuildWebImageSort
} from '../../../../../shared/build-web-image-types'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import { callBuildWeb } from '../build-web-client'

export const IMAGE_PAGE_SIZE = 50
const SEARCH_DEBOUNCE_MS = 300

type Loaded<T> = {
  data: T | null
  loading: boolean
  error: string | null
  reload: (refresh?: boolean) => void
}

/** One page of a computed image view; replies to an older request are dropped. */
function useImageQuery<A extends { q?: string }, T>(
  enabled: boolean,
  args: A,
  fetch: (args: A & { refresh?: boolean }) => Promise<T>
): Loaded<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const generation = useRef(0)
  const key = JSON.stringify(args)

  const load = useCallback(
    async (refresh = false) => {
      const mine = ++generation.current
      setLoading(true)
      try {
        const next = await fetch({ ...args, refresh })
        if (mine === generation.current) {
          setData(next)
          setError(null)
        }
      } catch (failure) {
        if (mine === generation.current) {
          setError(failure instanceof Error ? failure.message : String(failure))
        }
      } finally {
        if (mine === generation.current) {
          setLoading(false)
        }
      }
    },
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- `key` is `args` serialized; fetch is stable per target.
    [key, fetch]
  )

  useEffect(() => {
    if (!enabled) {
      return
    }
    const timer = window.setTimeout(() => void load(), args.q ? SEARCH_DEBOUNCE_MS : 0)
    return () => window.clearTimeout(timer)
  }, [enabled, load, args.q])

  return { data, loading, error, reload: (refresh) => void load(refresh) }
}

export function useImagePage(
  target: RuntimeClientTarget,
  enabled: boolean,
  args: BuildWebImagePageArgs
): Loaded<BuildWebImagePage> {
  const fetch = useCallback(
    (a: BuildWebImagePageArgs & { refresh?: boolean }) => callBuildWeb(target, 'listImages', a),
    [target]
  )
  return useImageQuery(enabled, args, fetch)
}

export function useImageHistory(
  target: RuntimeClientTarget,
  enabled: boolean,
  args: BuildWebImageHistoryArgs
): Loaded<BuildWebImageHistory> {
  const fetch = useCallback(
    (a: BuildWebImageHistoryArgs & { refresh?: boolean }) =>
      callBuildWeb(target, 'listImageBuilds', a),
    [target]
  )
  return useImageQuery(enabled, args, fetch)
}

/** Add or remove one value of a multi-select filter. */
export function toggled<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

/** A sortable column of an image table: unsorted until a header is clicked, then by it. */
export function useImageSort(onChange: () => void): {
  sort: BuildWebImageSort | null
  dir: 'asc' | 'desc'
  onSort: (sort: BuildWebImageSort) => void
} {
  const [state, setState] = useState<{ sort: BuildWebImageSort | null; dir: 'asc' | 'desc' }>({
    sort: null,
    dir: 'asc'
  })
  const onSort = (sort: BuildWebImageSort) => {
    setState((current) =>
      current.sort === sort
        ? { sort, dir: current.dir === 'asc' ? 'desc' : 'asc' }
        : // Newest first on the first click; for status and registry, ascending puts what
          // needs attention (failed, not pushed) on top.
          { sort, dir: sort === 'at' ? 'desc' : 'asc' }
    )
    onChange()
  }
  return { ...state, onSort }
}
