import { useCallback, useState } from 'react'
import type {
  BuildWebBuildFreshness,
  BuildWebFreshnessRef,
  BuildWebLastBuilt,
  BuildWebRun
} from '../../../../../../src/shared/build-web-run-types'
import { cellKey } from '../../../../../../src/renderer/src/components/build-web/issue/build/run-cells'
import { messageOf, useBuildTabCall } from './build-tab-call'

const registryNote = (error: string | null): string | null =>
  error ? `Registry state unknown — ${error}` : null

/**
 * Two read-only questions about the run: how each built image stands against its branch
 * (freshness, with a fetch on Rescan), and for each pending image its last CI build (Last built).
 */
export function useRunScan(
  runId: string,
  apply: (fresh: BuildWebRun) => void,
  onError: (message: string) => void
) {
  const { call } = useBuildTabCall()
  const [refs, setRefs] = useState<BuildWebFreshnessRef[]>([])
  const [freshness, setFreshness] = useState<Record<string, BuildWebBuildFreshness>>({})
  const [scanning, setScanning] = useState(false)
  const [scanNote, setScanNote] = useState<string | null>(null)
  const [lastBuilt, setLastBuilt] = useState<Record<string, BuildWebLastBuilt>>({})
  const [lastBuiltBusy, setLastBuiltBusy] = useState(false)
  const [lastBuiltNote, setLastBuiltNote] = useState<string | null>(null)

  /** Without a fetch when the tab opens or a build ends; Rescan fetches from Bitbucket first. */
  const scan = useCallback(
    async (withFetch: boolean) => {
      setScanning(true)
      try {
        const answer = await call('runFreshness', { runId, fetch: withFetch })
        setRefs(answer.refs)
        setFreshness(Object.fromEntries(answer.builds.map((b) => [b.key, b])))
        // Rows the scan moved onto a newer published image.
        if (answer.run) {
          apply(answer.run)
        }
        setScanNote(registryNote(answer.registry_error))
      } catch (failure) {
        if (withFetch) {
          onError(messageOf(failure))
        }
      } finally {
        setScanning(false)
      }
    },
    [apply, call, onError, runId]
  )

  const loadLastBuilt = useCallback(
    async (silent: boolean) => {
      setLastBuiltBusy(true)
      try {
        const answer = await call('lastBuilt', { runId })
        setLastBuilt(Object.fromEntries(answer.entries.map((e) => [cellKey(e), e])))
        setLastBuiltNote(registryNote(answer.probe_error))
      } catch (failure) {
        if (!silent) {
          onError(messageOf(failure))
        }
      } finally {
        setLastBuiltBusy(false)
      }
    },
    [call, onError, runId]
  )

  return {
    refs,
    freshness,
    scanning,
    scanNote,
    scan,
    lastBuilt,
    lastBuiltBusy,
    lastBuiltNote,
    loadLastBuilt
  }
}
