import type { WorktreeMeta } from '../../shared/worktree/meta-types'
import type { RemoveWorktreeResult } from '../../shared/worktree/create-types'
import type { BuildWebSessionReportQueue } from './build-web-session-report-queue'
import {
  removeBuildWebTaskWorktree,
  whyNotRemoveNow,
  type BuildWebSessionRemovalDeps,
  type BuildWebSessionRemovalOutcome
} from './build-web-session-removal'
import type { BuildWebWorktreeGitProbe } from './build-web-worktree-git-probe'

// A task worktree whose folder was deleted behind Orca's back (IS-147): the host drops what is left
// of it — Git's record, Orca's row, and Orca's own branch when it adds nothing — then tells the console.

export const GONE_FOLDER_NOTE = 'folder deleted outside Orca'

export type BuildWebGoneWorktree = {
  worktreeId: string
  sessionId: string
  consoleHost: string
  /** The branch Orca made for the task, the only one it may delete. */
  branch: string
}

export type BuildWebGoneRemovalDeps = Pick<
  BuildWebSessionRemovalDeps,
  'queueDelete' | 'remove' | 'forceDeleteBranch' | 'stopped'
> & {
  reports: Pick<BuildWebSessionReportQueue, 'hold' | 'release' | 'enqueue'>
  readMeta: () => Pick<WorktreeMeta, 'buildWebTask'> | undefined
  /** The folder is still missing and Git lists no live registration of it. */
  isGone: () => Promise<boolean>
  git: Pick<
    BuildWebWorktreeGitProbe,
    'readTaskBranch' | 'taskBranchAddsNothing' | 'deleteTaskBranch'
  >
}

/** Whether Orca's task branch is gone now; it is deleted only when proven to add no commit. */
async function dropTaskBranch(
  deps: Pick<BuildWebGoneRemovalDeps, 'git' | 'forceDeleteBranch'>,
  selector: string,
  target: BuildWebGoneWorktree,
  preserved: RemoveWorktreeResult['preservedBranch']
): Promise<boolean> {
  try {
    const sha = await deps.git.readTaskBranch()
    if (!sha) {
      return true
    }
    if (!(await deps.git.taskBranchAddsNothing())) {
      return false
    }
    // Why the runtime's path for a branch its delete kept: it also drops the offer to delete it.
    await (preserved?.branchName === target.branch && preserved.head === sha
      ? deps.forceDeleteBranch(selector, target.branch, sha)
      : deps.git.deleteTaskBranch(sha))
    return true
  } catch (error) {
    console.warn(`[build-web] could not delete branch ${target.branch}:`, error)
    return false
  }
}

export async function removeGoneBuildWebWorktree(
  deps: BuildWebGoneRemovalDeps,
  target: BuildWebGoneWorktree
): Promise<BuildWebSessionRemovalOutcome> {
  const outcome = await removeBuildWebTaskWorktree(deps, target, {
    slowChecks: async () =>
      (await deps.isGone().catch(() => false)) ? null : 'the folder is back',
    lastChecks: () =>
      whyNotRemoveNow(deps, target.worktreeId, () =>
        deps.readMeta()?.buildWebTask?.sessionId === target.sessionId
          ? null
          : 'the worktree no longer holds this session'
      ),
    notes: async (selector, result) => {
      const preserved = result.preservedBranch
      const kept = [
        ...(preserved && preserved.branchName !== target.branch ? [preserved.branchName] : []),
        ...((await dropTaskBranch(deps, selector, target, preserved)) ? [] : [target.branch])
      ]
      return [GONE_FOLDER_NOTE, ...kept.map((name) => `branch kept: ${name}`)]
    },
    external: true
  })
  if (outcome.kind === 'failed') {
    // Why: the folder is gone either way, so the console hears it; Orca's row stays for a person.
    deps.reports.enqueue({
      kind: 'worktree-removed',
      sessionId: target.sessionId,
      consoleHost: target.consoleHost,
      note: GONE_FOLDER_NOTE,
      external: true
    })
  }
  return outcome
}
