import type { BuildWebMutationResult } from '../../shared/build-web-types'
import { buildWebMutation } from './build-web-request'
import type { BuildWebSessionLinkRuntime } from './build-web-session-link'
import type { BuildWebSessionReportQueue } from './build-web-session-report-queue'
import { buildWebSessionReports } from './build-web-session-reports'

/**
 * «Keep»: the person takes the worktree out of the task's lifecycle; it is never cleaned up. The
 * console hears it through the durable queue, and the link goes in one write, so a deletion already
 * queued for this worktree sees the session gone and cancels.
 */
export function keepBuildWebWorktreeSession(
  runtime: BuildWebSessionLinkRuntime,
  worktreeId: string,
  reports: Pick<BuildWebSessionReportQueue, 'enqueue'> = buildWebSessionReports()
): Promise<BuildWebMutationResult<true>> {
  return buildWebMutation(async () => {
    const selector = `id:${worktreeId}`
    const task = (await runtime.showManagedWorktree(selector)).buildWebTask
    if (!task) {
      return true as const
    }
    if (task.sessionId) {
      reports.enqueue({ kind: 'keep', sessionId: task.sessionId, consoleHost: task.consoleHost })
    }
    await runtime.updateManagedWorktreeMeta(selector, { buildWebTask: null, buildWebSession: null })
    return true as const
  })
}
