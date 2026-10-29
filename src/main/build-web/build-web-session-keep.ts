import type { BuildWebMutationResult } from '../../shared/build-web-types'
import { buildWebMutation } from './build-web-request'
import type { BuildWebSessionLinkRuntime } from './build-web-session-link'
import type { BuildWebSessionReportQueue } from './build-web-session-report-queue'
import { buildWebSessionReports } from './build-web-session-reports'
import { beginBuildWebKeep } from './build-web-task-worktree-claims'

/**
 * «Keep»: the person takes the worktree out of the task's lifecycle; it is never cleaned up. The
 * console hears it through the durable queue, and the link goes in one write. A deletion already
 * queued for this worktree cancels: its last check sees this Keep running or the session gone.
 * Throws once a deletion has passed that check. Every way of dropping the link comes here.
 */
export async function keepBuildWebTaskLink(
  runtime: BuildWebSessionLinkRuntime,
  worktreeId: string,
  reports: Pick<BuildWebSessionReportQueue, 'enqueue'> = buildWebSessionReports()
): Promise<void> {
  // Why first, before any await: it is what a finisher delete in its last check looks for.
  const release = beginBuildWebKeep(worktreeId)
  try {
    const selector = `id:${worktreeId}`
    const task = (await runtime.showManagedWorktree(selector)).buildWebTask
    if (!task) {
      return
    }
    if (task.sessionId) {
      reports.enqueue({ kind: 'keep', sessionId: task.sessionId, consoleHost: task.consoleHost })
    }
    await runtime.updateManagedWorktreeMeta(selector, {
      buildWebTask: null,
      buildWebSession: null
    })
  } finally {
    release()
  }
}

/** `buildWeb.keepWorktreeSession`: Keep, answered the way the task card's calls are. */
export function keepBuildWebWorktreeSession(
  runtime: BuildWebSessionLinkRuntime,
  worktreeId: string,
  reports: Pick<BuildWebSessionReportQueue, 'enqueue'> = buildWebSessionReports()
): Promise<BuildWebMutationResult<true>> {
  return buildWebMutation(async () => {
    await keepBuildWebTaskLink(runtime, worktreeId, reports)
    return true as const
  })
}
