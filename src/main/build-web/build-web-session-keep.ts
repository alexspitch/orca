import type { BuildWebMutationResult } from '../../shared/build-web-types'
import { buildWebMutation } from './build-web-request'
import { keepBuildWebAgentSession } from './build-web-agent-sessions'
import type { BuildWebSessionLinkRuntime } from './build-web-session-link'

/** «Keep»: the person takes the worktree out of the task's lifecycle; it is never cleaned up. */
export function keepBuildWebWorktreeSession(
  runtime: BuildWebSessionLinkRuntime,
  worktreeId: string
): Promise<BuildWebMutationResult<true>> {
  return buildWebMutation(async () => {
    const selector = `id:${worktreeId}`
    const task = (await runtime.showManagedWorktree(selector)).buildWebTask
    if (!task) {
      return true as const
    }
    if (task.sessionId) {
      await keepBuildWebAgentSession(task.sessionId)
    }
    await runtime.updateManagedWorktreeMeta(selector, { buildWebTask: null, buildWebSession: null })
    return true as const
  })
}
