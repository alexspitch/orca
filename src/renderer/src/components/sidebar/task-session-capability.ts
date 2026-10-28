import type { AppState } from '@/store/types'
import { BUILD_WEB_WORKTREE_TASK_RUNTIME_CAPABILITY } from '../../../../shared/build-web-capability'
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

export function runtimeEnvironmentKnowsTaskSessions(
  state: CapabilityState,
  environmentId: string
): boolean {
  return (
    state.runtimeStatusByEnvironmentId
      ?.get(environmentId)
      ?.status?.capabilities?.includes(BUILD_WEB_WORKTREE_TASK_RUNTIME_CAPABILITY) === true
  )
}

/**
 * Whether the host holding this client's UI state takes `groupBy: 'task'` and the session filter:
 * this app's own main process does; a browser client's paired server must announce it.
 */
export function selectTaskSessionUiAvailable(state: CapabilityState): boolean {
  if (!isWebClient()) {
    return true
  }
  for (const environmentId of state.runtimeStatusByEnvironmentId?.keys() ?? []) {
    if (runtimeEnvironmentKnowsTaskSessions(state, environmentId)) {
      return true
    }
  }
  return false
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
