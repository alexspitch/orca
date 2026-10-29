import {
  BUILD_WEB_INPUT_REQUIRED_GROUP_RUNTIME_CAPABILITY,
  BUILD_WEB_WORKTREE_TASK_RUNTIME_CAPABILITY
} from '../../../../shared/build-web-capability'
import { callRuntimeResult, getRemoteRuntimeStatus } from './web-runtime-calls'

type TaskSessionUiFields = {
  groupBy?: unknown
  hiddenSessionStates?: unknown
  showInputRequiredGroup?: unknown
}

function hasTaskSessionUiFields(updates: TaskSessionUiFields): boolean {
  return (
    updates.groupBy === 'task' ||
    updates.hiddenSessionStates !== undefined ||
    updates.showInputRequiredGroup !== undefined
  )
}

// Why: an older host's strict ui.set rejects the whole payload for `groupBy: 'task'`, the
// session filter or the Input required switch (IS-147), so they stay in this browser until the
// host announces them.
async function withoutUnsupportedTaskSessionUiFields<T extends TaskSessionUiFields>(
  updates: T
): Promise<T> {
  const status = await getRemoteRuntimeStatus().catch(() => null)
  const capabilities = status?.capabilities ?? []
  const supported = { ...updates }
  if (!capabilities.includes(BUILD_WEB_INPUT_REQUIRED_GROUP_RUNTIME_CAPABILITY)) {
    delete supported.showInputRequiredGroup
  }
  if (capabilities.includes(BUILD_WEB_WORKTREE_TASK_RUNTIME_CAPABILITY)) {
    return supported
  }
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
export async function sendHostUiUpdates<T extends TaskSessionUiFields>(updates: T): Promise<T> {
  const sent = hasTaskSessionUiFields(updates)
    ? await withoutUnsupportedTaskSessionUiFields(updates)
    : updates
  await callRuntimeResult('ui.set', sent, 15_000)
  return sent
}
