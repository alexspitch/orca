import { useCallback, useState } from 'react'
import { translate } from '@/i18n/i18n'
import type {
  BuildWebBuildFreshness,
  BuildWebFreshnessRef,
  BuildWebLastBuilt,
  BuildWebRun
} from '../../../../../../shared/build-web-run-types'
import type { RuntimeClientTarget } from '../../../../../../shared/runtime-client-target'
import { callBuildWeb } from '../../build-web-client'
import { cellKey } from './run-cells'

const messageOf = (failure: unknown) =>
  failure instanceof Error ? failure.message : String(failure)

function registryNote(error: string | null): string | null {
  return error
    ? translate('buildWeb.run.registryUnknown', 'Registry state unknown — {{error}}', { error })
    : null
}

/**
 * Two read-only questions about the run, after build-web's Progress: how each built image stands
 * against its branch (freshness, with a fetch on Rescan), and for each pending image its last CI
 * build and whether anything changed since (Last built).
 */
export function useRunScan(
  target: RuntimeClientTarget,
  runId: string,
  apply: (fresh: BuildWebRun) => void,
  onError: (message: string) => void
) {
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
        const answer = await callBuildWeb(target, 'runFreshness', { runId, fetch: withFetch })
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
    [apply, onError, runId, target]
  )

  const loadLastBuilt = useCallback(
    async (silent: boolean) => {
      setLastBuiltBusy(true)
      try {
        const answer = await callBuildWeb(target, 'lastBuilt', { runId })
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
    [onError, runId, target]
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

export type RunScan = ReturnType<typeof useRunScan>
