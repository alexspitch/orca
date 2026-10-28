import { useEffect, useRef, useState } from 'react'
import type {
  BuildWebTaskPage,
  BuildWebTaskPageArgs
} from '../../../../../shared/build-web-activity-types'
import { callBuildWeb } from '../build-web-client'
import type { ActivityHost } from './open-activity-target'

/** One page of the console's /tasks; the last page read stays shown while the next one loads. */
export function useTaskPage(
  host: ActivityHost,
  args: BuildWebTaskPageArgs,
  open: boolean
): { page: BuildWebTaskPage | null; loading: boolean; error: string | null } {
  const [page, setPage] = useState<BuildWebTaskPage | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Why by value: the filters arrive as a new object on every render.
  const key = JSON.stringify(args)
  const argsRef = useRef(args)
  argsRef.current = args
  useEffect(() => {
    if (!open) {
      return
    }
    let alive = true
    setLoading(true)
    callBuildWeb(host.target, 'taskPage', argsRef.current)
      .then((next) => {
        if (alive) {
          setPage(next)
          setError(null)
        }
      })
      .catch((failure: unknown) => {
        if (alive) {
          setError(failure instanceof Error ? failure.message : String(failure))
        }
      })
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [host.target, key, open])
  return { page, loading, error }
}
