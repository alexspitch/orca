import type { AppState } from '@/store/types'
import {
  BUILD_WEB_INPUT_REQUIRED_GROUP_RUNTIME_CAPABILITY,
  BUILD_WEB_WORKTREE_TASK_RUNTIME_CAPABILITY
} from '../../../../shared/build-web-capability'
import {
  getWorktreeExecutionHostId,
  parseExecutionHostId,
  type ExecutionHostId
} from '../../../../shared/execution-host'
import type { Repo } from '../../../../shared/repo-types'
import type { Worktree } from '../../../../shared/worktree/types'
import { isWebClient } from './worktree-card-model'

// IS-147: only a host announcing `build-web-worktree-task.v1` reports task sessions and accepts the
// «By task» UI keys. This app's own main process always does; a paired server may predate it.

type CapabilityState = Pick<AppState, 'runtimeStatusByEnvironmentId'>

function runtimeEnvironmentAnnounces(
  state: CapabilityState,
  environmentId: string,
  capability: string
): boolean {
  return (
    state.runtimeStatusByEnvironmentId
      ?.get(environmentId)
      ?.status?.capabilities?.includes(capability) === true
  )
}

export function runtimeEnvironmentKnowsTaskSessions(
  state: CapabilityState,
  environmentId: string
): boolean {
  return runtimeEnvironmentAnnounces(
    state,
    environmentId,
    BUILD_WEB_WORKTREE_TASK_RUNTIME_CAPABILITY
  )
}

// This app's own main process takes every UI key; a browser client's paired server must announce it.
function hostUiTakes(state: CapabilityState, capability: string): boolean {
  if (!isWebClient()) {
    return true
  }
  for (const environmentId of state.runtimeStatusByEnvironmentId?.keys() ?? []) {
    if (runtimeEnvironmentAnnounces(state, environmentId, capability)) {
      return true
    }
  }
  return false
}

/** Whether the host holding this client's UI state takes `groupBy: 'task'` and the session filter. */
export function selectTaskSessionUiAvailable(state: CapabilityState): boolean {
  return hostUiTakes(state, BUILD_WEB_WORKTREE_TASK_RUNTIME_CAPABILITY)
}

/** Whether that host takes `showInputRequiredGroup`, the Input required switch. */
export function selectInputRequiredGroupSwitchAvailable(state: CapabilityState): boolean {
  return hostUiTakes(state, BUILD_WEB_INPUT_REQUIRED_GROUP_RUNTIME_CAPABILITY)
}

/** Whether a row's host reports tasks: local and SSH rows come from this app's main process. */
export function createTaskSessionHostReader(
  state: CapabilityState,
  defaultHostId: ExecutionHostId
): (worktree: Pick<Worktree, 'hostId'>, repo: Repo | undefined) => boolean {
  return (worktree, repo) => {
    const host = parseExecutionHostId(getWorktreeExecutionHostId(worktree, repo, defaultHostId))
    return (
      host?.kind !== 'runtime' || runtimeEnvironmentKnowsTaskSessions(state, host.environmentId)
    )
  }
}
