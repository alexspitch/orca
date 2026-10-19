import { useCallback, useEffect, useRef, useState } from 'react'
import type { BuildWebStandStatus } from '../../../../../shared/build-web-stand-types'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import { callBuildWeb } from '../build-web-client'

export type StandStatusState = {
  status: BuildWebStandStatus | null
  error: string | null
  loading: boolean
  reload: () => void
}

/** What the stand runs; read on open and on demand, an answer to an older read dropped. */
export function useStandStatus(target: RuntimeClientTarget, standId: string): StandStatusState {
  const [status, setStatus] = useState<BuildWebStandStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const latest = useRef(0)
  const load = useCallback(async () => {
    const mine = ++latest.current
    setLoading(true)
    try {
      const result = await callBuildWeb(target, 'standStatus', { standId })
      if (mine !== latest.current) {
        return
      }
      if (result.ok) {
        setStatus(result.value)
        setError(null)
      } else {
        setError(result.error)
      }
    } catch (failure) {
      if (mine === latest.current) {
        setError(failure instanceof Error ? failure.message : String(failure))
      }
    } finally {
      if (mine === latest.current) {
        setLoading(false)
      }
    }
  }, [standId, target])
  useEffect(() => {
    setStatus(null)
    setError(null)
    void load()
  }, [load])
  return { status, error, loading, reload: () => void load() }
}
