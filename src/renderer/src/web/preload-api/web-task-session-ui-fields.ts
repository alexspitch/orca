import { BUILD_WEB_WORKTREE_TASK_RUNTIME_CAPABILITY } from '../../../../shared/build-web-capability'
import { callRuntimeResult, getRemoteRuntimeStatus } from './web-runtime-calls'

function hasTaskSessionUiFields(updates: {
  groupBy?: unknown
  hiddenSessionStates?: unknown
}): boolean {
  return updates.groupBy === 'task' || updates.hiddenSessionStates !== undefined
}

// Why: an older host's strict ui.set rejects the whole payload for `groupBy: 'task'` or the
// session filter (IS-147), so they stay in this browser until the host announces them.
async function withoutUnsupportedTaskSessionUiFields<
  T extends { groupBy?: unknown; hiddenSessionStates?: unknown }
>(updates: T): Promise<T> {
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

/**
 * Sends a UI update to the paired host and returns what it sent. Why the probe only for the task
 * fields: an await before every write would reorder it behind the status call.
 */
export async function sendHostUiUpdates<
  T extends { groupBy?: unknown; hiddenSessionStates?: unknown }
>(updates: T): Promise<T> {
  const sent = hasTaskSessionUiFields(updates)
    ? await withoutUnsupportedTaskSessionUiFields(updates)
    : updates
  await callRuntimeResult('ui.set', sent, 15_000)
  return sent
}
