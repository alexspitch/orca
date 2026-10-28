import { BUILD_WEB_WORKTREE_TASK_RUNTIME_CAPABILITY } from '../../../../shared/build-web-capability'
import { getRemoteRuntimeStatus } from './web-runtime-calls'

// Why: an older host's strict ui.set rejects the whole payload for `groupBy: 'task'` or the
// session filter (IS-147), so they stay in this browser until the host announces them.
export async function withoutUnsupportedTaskSessionUiFields<
  T extends { groupBy?: unknown; hiddenSessionStates?: unknown }
>(updates: T): Promise<T> {
  if (updates.groupBy !== 'task' && updates.hiddenSessionStates === undefined) {
    return updates
  }
  const status = await getRemoteRuntimeStatus().catch(() => null)
  if (status?.capabilities?.includes(BUILD_WEB_WORKTREE_TASK_RUNTIME_CAPABILITY)) {
    return updates
  }
  const supported = { ...updates }
  delete supported.hiddenSessionStates
  if (supported.groupBy === 'task') {
    delete supported.groupBy
  }
  return supported
}
