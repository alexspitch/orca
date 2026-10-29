import {
  lastVerifiedRuntimeStatus,
  type RuntimeHostStatusSnapshot
} from '../../../shared/runtime-host-status'
import type { RuntimeStatus } from '../../../shared/runtime-types'
import {
  isDisconnectedRuntimeHostState,
  runtimeHostConnectionStateForEntry
} from '@/runtime/runtime-host-connection-state'
import type { WorktreeRuntimeOwnerState } from './worktree-runtime-owner-state'
import { getRuntimeSessionMirrorEnvironmentIds } from './runtime-session-mirror-owners'
import { tabsSyncDebug } from '@/runtime/web-session-tabs-sync/tabs-sync-debug'

type RuntimeMirrorStatus = {
  status: RuntimeStatus | null
  remoteControl?: RuntimeStatus['remoteControl'] | null
  snapshot?: RuntimeHostStatusSnapshot
  connectionGeneration?: number
  hostContactEpoch?: number
}

type RuntimeMirrorEnvironment = {
  id: string
  createdAt: number
  pairingRevision?: number
}

export type RuntimeSessionMirrorTarget = {
  environmentId: string
  runtimeId: string
  connectionGeneration: number
  pairingRevision: number
  hostContactEpoch: number
}

export type RuntimeSessionMirrorTargetState = Omit<
  WorktreeRuntimeOwnerState,
  'runtimeEnvironments'
> & {
  runtimeEnvironments?: readonly RuntimeMirrorEnvironment[]
  runtimeStatusByEnvironmentId?: ReadonlyMap<string, RuntimeMirrorStatus>
}

export function getReachableRuntimeSessionMirrorTargets(
  state: RuntimeSessionMirrorTargetState
): RuntimeSessionMirrorTarget[] {
  const environmentById = new Map(
    (state.runtimeEnvironments ?? []).map((environment) => [environment.id, environment])
  )
  const targets: RuntimeSessionMirrorTarget[] = []
  for (const environmentId of getRuntimeSessionMirrorEnvironmentIds(state)) {
    const entry = state.runtimeStatusByEnvironmentId?.get(environmentId)
    const debugFacts = {
      env: environmentId,
      connection: runtimeHostConnectionStateForEntry(entry),
      verification: entry?.snapshot?.verification,
      transport: entry?.snapshot?.transport,
      status: Boolean(entry?.status),
      snapshotStatus: Boolean(entry?.snapshot?.status)
    }
    // Use the shared exit verdict: ready transports can have unverifiable probes with null status while flows still deliver. Only confirmed exit permits destructive mirror teardown; checking/reconnecting do not (ssh-execution-boundary.md).
    if (isDisconnectedRuntimeHostState(runtimeHostConnectionStateForEntry(entry))) {
      tabsSyncDebug('mirror-target', { ...debugFacts, verdict: 'skip:disconnected' }, environmentId)
      continue
    }
    const runtimeId = lastVerifiedRuntimeStatus(entry)?.runtimeId
    if (!runtimeId) {
      tabsSyncDebug(
        'mirror-target',
        { ...debugFacts, verdict: 'skip:no-runtime-id' },
        environmentId
      )
      continue
    }
    const environment = environmentById.get(environmentId)
    if (!environment) {
      tabsSyncDebug(
        'mirror-target',
        { ...debugFacts, verdict: 'skip:no-environment' },
        environmentId
      )
      continue
    }
    tabsSyncDebug('mirror-target', { ...debugFacts, verdict: 'target', runtimeId }, environmentId)
    targets.push({
      environmentId,
      runtimeId,
      connectionGeneration: entry?.connectionGeneration ?? 0,
      pairingRevision: environment.pairingRevision ?? environment.createdAt,
      hostContactEpoch: entry?.hostContactEpoch ?? 0
    })
  }
  return targets
}
