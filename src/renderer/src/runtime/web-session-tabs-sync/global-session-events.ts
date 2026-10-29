import type { RuntimeRpcResponse } from '../../../../shared/runtime-rpc-envelope'
import type { RuntimeMobileSessionTabsResult } from '../../../../shared/runtime-types'
import { isRuntimeSubscriptionReplayResponse } from '../../../../shared/runtime-subscription-replay'
import { useAppStore } from '../../store'
import { recoverMirroredTerminalOrphansBeforeApply } from './mirror-terminal-orphan-recovery'
import {
  recordReceivedWebSessionTabsSnapshot,
  sessionTabsFreshnessKey,
  shouldApplyRecoveredWebSessionTabsSnapshot
} from './tracking'
import { decideWebSessionTabsSnapshot } from './tracking-decisions'
import { acceptReplayedWebSessionTabsSnapshot } from './tracking-lifecycle'
import {
  acceptSessionTabsRuntimeId,
  getSessionTabsRuntimeIdFromResponse,
  isRetiredSessionTabsPublicationEpoch
} from './publisher-identity-fences'
import { scheduleRetiredEpochCensus } from './retired-epoch-census'
import { applyWebSessionTabsSnapshot } from './snapshot-api'
import { applyWebSessionTabsStorePatch } from './store-patch'
import {
  hostSessionMirrorSettleForPatchlessFrame,
  type HostSessionMirrorSettle
} from './mirror-settle'
import { handleGlobalSessionInventoryEvent } from './global-session-inventory-event'
import type { VisibilityResumeCoordinator } from './visibility-resume-coordinator'
import { tabsSyncDebug, tabsSyncDebugWorktree } from './tabs-sync-debug'
import { selectWorktreeAgentActivitySummary } from '@/components/sidebar/worktree-agent-activity-summary'

function debugWorktreeStatus(worktreeId: string): void {
  // Why a timer: the store patch may land after this frame's handler returns.
  setTimeout(() => {
    const state = useAppStore.getState()
    const rows = Object.entries(state.agentStatusByPaneKey)
      .filter(([, entry]) => entry.worktreeId === worktreeId)
      .map(([paneKey, entry]) => `${paneKey.slice(0, 22)}=${entry.state}`)
    const summary = selectWorktreeAgentActivitySummary(state, worktreeId)
    tabsSyncDebug('global-applied', {
      wt: tabsSyncDebugWorktree(worktreeId),
      rows,
      hasPermission: summary.hasPermission,
      hasLiveWorking: summary.hasLiveWorking,
      hasLiveDone: summary.hasLiveDone,
      tabs: (state.tabsByWorktree[worktreeId] ?? []).length,
      activeWorktree: tabsSyncDebugWorktree(state.activeWorktreeId ?? '')
    })
  }, 0)
}

export type GlobalSessionEventArgs = {
  environmentId: string
  expectedEnvironmentConnectionGeneration: number
  expectedEnvironmentPairingRevision?: number
  expectedTrackingGeneration: number
  visibilityGeneration: number
  isCurrent: () => boolean
  event: unknown
  response: RuntimeRpcResponse<unknown>
  awaitingVisibilityResumeInventory: { value: boolean }
  coordinator: VisibilityResumeCoordinator
}

export function handleGlobalSessionEvent(args: GlobalSessionEventArgs): void {
  const {
    environmentId,
    expectedEnvironmentConnectionGeneration,
    expectedEnvironmentPairingRevision,
    expectedTrackingGeneration,
    visibilityGeneration,
    isCurrent,
    response,
    awaitingVisibilityResumeInventory,
    coordinator
  } = args
  if (!isCurrent()) {
    tabsSyncDebug('global-drop', { env: environmentId, reason: 'not-current' })
    return
  }
  if (response.ok === false) {
    console.warn('[web-session-tabs-sync] global subscription failed:', response.error.message)
    return
  }
  const runtimeId = getSessionTabsRuntimeIdFromResponse(response)
  if (runtimeId && !acceptSessionTabsRuntimeId(environmentId, runtimeId)) {
    tabsSyncDebug('global-drop', { env: environmentId, reason: 'runtime-id-rejected', runtimeId })
    return
  }
  const event = args.event as
    | (RuntimeMobileSessionTabsResult & { type: 'snapshot' | 'updated' })
    | { type: 'snapshots'; snapshots: RuntimeMobileSessionTabsResult[]; authoritative?: boolean }
    | { type: 'end' }
  const replayed = isRuntimeSubscriptionReplayResponse(response)
  if (event.type === 'snapshots') {
    handleGlobalSessionInventoryEvent({
      environmentId,
      expectedEnvironmentConnectionGeneration,
      expectedEnvironmentPairingRevision,
      expectedTrackingGeneration,
      visibilityGeneration,
      isCurrent,
      event,
      replayed,
      runtimeId,
      awaitingVisibilityResumeInventory,
      coordinator
    })
    return
  }
  if (event.type !== 'snapshot' && event.type !== 'updated') {
    return
  }
  const receivedFrame = recordReceivedWebSessionTabsSnapshot(
    environmentId,
    event,
    undefined,
    runtimeId
  )
  coordinator.recordSnapshotReceipt(environmentId, event, receivedFrame, runtimeId)
  if (
    isRetiredSessionTabsPublicationEpoch(
      sessionTabsFreshnessKey(environmentId, event.worktree),
      event.publicationEpoch
    )
  ) {
    // Why: the fence drops this frame; only the host's census can say whether its publisher lives.
    scheduleRetiredEpochCensus(
      {
        environmentId,
        expectedEnvironmentPairingRevision,
        isCurrent,
        applySnapshot: (snapshot, censusResponse) =>
          handleGlobalSessionEvent({
            ...args,
            event: { ...snapshot, type: 'snapshot' },
            response: censusResponse
          })
      },
      event.worktree,
      event.publicationEpoch
    )
  }
  let settleHydration: HostSessionMirrorSettle | null = null
  void recoverMirroredTerminalOrphansBeforeApply(useAppStore.getState(), event, environmentId, {
    expectedEnvironmentPairingRevision,
    expectedRuntimeId: runtimeId,
    getCurrentState: () => useAppStore.getState()
  })
    .then((recovered) => {
      const debugBase = {
        env: environmentId,
        wt: tabsSyncDebugWorktree(event.worktree),
        v: event.snapshotVersion,
        receivedFrame
      }
      if (!isCurrent()) {
        tabsSyncDebug('global-drop', { ...debugBase, reason: 'not-current-after-recovery' })
        return
      }
      if (!recovered) {
        tabsSyncDebug('global-drop', { ...debugBase, reason: 'recovery-returned-null' })
        return
      }
      if (
        !shouldApplyRecoveredWebSessionTabsSnapshot(
          environmentId,
          recovered,
          receivedFrame,
          runtimeId
        )
      ) {
        tabsSyncDebug('global-drop', { ...debugBase, reason: 'stale-received-frame' })
        return
      }
      if (!coordinator.shouldApplySnapshot(environmentId, recovered, receivedFrame, runtimeId)) {
        tabsSyncDebug('global-drop', { ...debugBase, reason: 'visibility-coordinator' })
        return
      }
      if (replayed) {
        acceptReplayedWebSessionTabsSnapshot(environmentId, recovered.worktree)
      }
      const decision = decideWebSessionTabsSnapshot(recovered, environmentId, runtimeId)
      tabsSyncDebug('global-decision', { ...debugBase, replayed, ...decision })
      if (decision.apply) {
        settleHydration = applyWebSessionTabsStorePatch(
          (state) => applyWebSessionTabsSnapshot(state, recovered, environmentId),
          {
            frames: [
              {
                environmentId,
                worktreeId: recovered.worktree,
                source: recovered,
                decision,
                expectedEnvironmentConnectionGeneration,
                expectedEnvironmentPairingRevision,
                expectedTrackingGeneration
              }
            ]
          },
          recovered,
          event.type === 'updated' && !replayed
        )
        coordinator.recordSnapshot(environmentId, recovered, receivedFrame, runtimeId)
        debugWorktreeStatus(recovered.worktree)
      } else {
        settleHydration = hostSessionMirrorSettleForPatchlessFrame(
          decision,
          environmentId,
          recovered.worktree,
          {
            connectionGeneration: expectedEnvironmentConnectionGeneration,
            pairingRevision: expectedEnvironmentPairingRevision,
            trackingGeneration: expectedTrackingGeneration
          }
        )
      }
    })
    .catch((error) => {
      tabsSyncDebug('global-drop', {
        env: environmentId,
        reason: 'recovery-threw',
        message: error instanceof Error ? error.message : String(error)
      })
      if (isCurrent()) {
        console.warn('[web-session-tabs-sync] snapshot recovery failed:', error)
      }
    })
    .finally(() => {
      if (isCurrent()) {
        settleHydration?.()
      }
    })
}
