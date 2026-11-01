import type { WorktreeMeta } from '../../shared/worktree/meta-types'
import type { BuildWebSessionReportQueue } from './build-web-session-report-queue'
import {
  removeBuildWebTaskWorktree,
  whyNotRemoveNow,
  type BuildWebSessionRemovalDeps,
  type BuildWebSessionRemovalOutcome
} from './build-web-session-removal'
import { settleTaskBranches } from './build-web-task-branch-drop'

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
  'queueDelete' | 'remove' | 'forceDeleteBranch' | 'git' | 'stopped'
> & {
  reports: Pick<BuildWebSessionReportQueue, 'hold' | 'release' | 'enqueue'>
  readMeta: () => Pick<WorktreeMeta, 'buildWebTask'> | undefined
  /** The folder is still missing and Git lists no live registration of it. */
  isGone: () => Promise<boolean>
  /** A delete through Orca runs or failed: that delete reports itself. */
  removalUnderway: () => boolean
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
        deps.removalUnderway()
          ? 'a delete through Orca is under way'
          : deps.readMeta()?.buildWebTask?.sessionId === target.sessionId
            ? null
            : 'the worktree no longer holds this session'
      ),
    notes: async (selector, result) => [
      GONE_FOLDER_NOTE,
      ...(await settleTaskBranches(deps, selector, target.branch, result.preservedBranch))
    ],
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
