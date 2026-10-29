import { useMemo } from 'react'
import { useAppStore } from '@/store'
import { runtimeRpcTargetForAuthorityKey } from '@/runtime/runtime-client-target'
import { recordedSessionServer } from '../../../../shared/build-web-session-host'
import { LOCAL_EXECUTION_HOST_ID } from '../../../../shared/execution-host'
import {
  lastVerifiedRuntimeStatus,
  type RuntimeEnvironmentStatus
} from '../../../../shared/runtime-host-status'
import type { RuntimeClientTarget } from '../../../../shared/runtime-client-target'
import type { SessionListRow } from './BuildWebSessionList'
import { newerMethodCapability } from './build-web-newer-methods'

/**
 * The host that ran the session: its worktree's while it is here; once removed, the server its
 * record names when this client paired it, else the host holding build-web's token.
 */
function sessionLogTarget(
  row: SessionListRow,
  buildWebTarget: RuntimeClientTarget,
  environmentIds: ReadonlySet<string>
): RuntimeClientTarget {
  if (row.worktree) {
    return (
      runtimeRpcTargetForAuthorityKey(row.worktree.hostId ?? LOCAL_EXECUTION_HOST_ID) ??
      buildWebTarget
    )
  }
  const server = recordedSessionServer(row.record.execution_host_id, (host) =>
    environmentIds.has(host.environmentId)
  )
  return server ? { kind: 'environment', environmentId: server.environmentId } : buildWebTarget
}

function servesTranscripts(
  target: RuntimeClientTarget,
  statusByEnvironmentId: ReadonlyMap<string, RuntimeEnvironmentStatus>
): boolean {
  const capability = newerMethodCapability('sessionTranscript')
  // Why: this app's own main process always hands logs out.
  if (target.kind === 'local' || capability === null) {
    return true
  }
  const status = lastVerifiedRuntimeStatus(statusByEnvironmentId.get(target.environmentId))
  return status?.capabilities?.includes(capability) === true
}

/**
 * Per session, the host that reads its log, as the phone's card routes it; a session is absent when
 * the agent's own session id is unknown or that host predates session logs.
 */
export function useSessionLogTargets(
  rows: readonly SessionListRow[],
  buildWebTarget: RuntimeClientTarget
): ReadonlyMap<string, RuntimeClientTarget> {
  const environments = useAppStore((s) => s.runtimeEnvironments)
  const statusByEnvironmentId = useAppStore((s) => s.runtimeStatusByEnvironmentId)
  const targetKey = buildWebTarget.kind === 'local' ? 'local' : buildWebTarget.environmentId
  return useMemo(() => {
    const environmentIds = new Set(environments.map((environment) => environment.id))
    const targets = new Map<string, RuntimeClientTarget>()
    for (const row of rows) {
      if (!row.record.provider_session_id) {
        continue
      }
      const target = sessionLogTarget(row, buildWebTarget, environmentIds)
      if (servesTranscripts(target, statusByEnvironmentId)) {
        targets.set(row.record.id, target)
      }
    }
    return targets
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `buildWebTarget` is a fresh object each render; its key names it.
  }, [rows, targetKey, environments, statusByEnvironmentId])
}
