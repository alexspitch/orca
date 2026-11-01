import type { RemoveWorktreeResult } from '../../shared/worktree/create-types'
import { withSpan } from '../observability/tracer'
import type { BuildWebWorktreeGitProbe } from './build-web-worktree-git-probe'

// The branch Orca made for a task (IS-147), once its worktree is gone — whoever deleted it: the
// finisher, a folder deleted behind Orca's back, or a person. The remote branch is the skill's.

export type BuildWebTaskBranchGit = Pick<
  BuildWebWorktreeGitProbe,
  'readTaskBranch' | 'taskBranchAddsNothing' | 'deleteTaskBranch'
>

export type BuildWebTaskBranchDropOutcome =
  | 'gone'
  | 'deleted'
  | 'kept:adds-commits'
  | 'kept:checked-out'
  | 'kept:error'

const CHECKED_OUT = /checked out/i

/**
 * Deletes the task branch only when it adds no commit to the base; never throws. `deletePreserved`
 * is the runtime's delete of a branch its worktree delete kept (it also drops the offer to delete
 * it); when it refuses, the branch is deleted at the commit read here.
 */
export function dropBuildWebTaskBranch(
  deps: {
    git: BuildWebTaskBranchGit
    deletePreserved?: (sha: string) => Promise<unknown>
  },
  branch: string
): Promise<BuildWebTaskBranchDropOutcome> {
  return withSpan(
    'build-web.task_branch.drop',
    async (span) => {
      const outcome = await dropUntraced(deps, branch)
      span.setAttribute('build_web.task_branch.outcome', outcome)
      return outcome
    },
    { attributes: { 'build_web.task_branch': branch } }
  )
}

async function dropUntraced(
  deps: Parameters<typeof dropBuildWebTaskBranch>[0],
  branch: string
): Promise<BuildWebTaskBranchDropOutcome> {
  try {
    const sha = await deps.git.readTaskBranch()
    if (!sha) {
      return 'gone'
    }
    if (!(await deps.git.taskBranchAddsNothing())) {
      return 'kept:adds-commits'
    }
    const preserved = deps.deletePreserved
    await (preserved
      ? preserved(sha).catch(() => deps.git.deleteTaskBranch(sha))
      : deps.git.deleteTaskBranch(sha))
    return 'deleted'
  } catch (error) {
    console.warn(`[build-web] could not delete branch ${branch}:`, error)
    return error instanceof Error && CHECKED_OUT.test(error.message)
      ? 'kept:checked-out'
      : 'kept:error'
  }
}

/**
 * After a task worktree's delete: the task branch goes when it adds nothing, and the report names
 * every branch left behind — it, or another branch the delete kept (where HEAD stood instead).
 */
export async function settleTaskBranches(
  deps: {
    git: BuildWebTaskBranchGit
    forceDeleteBranch: (selector: string, branchName: string, head: string) => Promise<unknown>
  },
  selector: string,
  branch: string,
  preserved: RemoveWorktreeResult['preservedBranch']
): Promise<string[]> {
  const outcome = await dropBuildWebTaskBranch(
    {
      git: deps.git,
      ...(preserved?.branchName === branch
        ? { deletePreserved: (sha: string) => deps.forceDeleteBranch(selector, branch, sha) }
        : {})
    },
    branch
  )
  const kept = [
    ...(preserved && preserved.branchName !== branch ? [preserved.branchName] : []),
    ...(outcome.startsWith('kept') ? [branch] : [])
  ]
  return kept.map((name) => `branch kept: ${name}`)
}
