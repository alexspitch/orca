import type { GitHistoryExecutor } from './git-history-types'
import type { GitLogOperation, GitLogOperationResult } from './git-log-operation-types'
import {
  checkoutAndRebase,
  checkoutRef,
  checkoutRevision,
  createBranch,
  deleteBranch,
  mergeRef,
  rebaseOnto,
  renameBranch
} from './git-log-branch-operations'
import { cherryPick, createTag } from './git-log-commit-operations'
import { failed } from './git-log-operation-outcome'
import {
  deleteRemoteBranch,
  fetchAllRemotes,
  pushBranch,
  updateBranch
} from './git-log-remote-operations'

/** Operations that talk to a remote and may take minutes. */
export function isGitLogNetworkOperation(operation: GitLogOperation): boolean {
  return (
    operation.kind === 'fetchAll' ||
    operation.kind === 'updateBranch' ||
    operation.kind === 'pushBranch' ||
    operation.kind === 'deleteRemoteBranch'
  )
}

function dispatch(
  run: { git: GitHistoryExecutor; cwd: string },
  operation: GitLogOperation
): Promise<GitLogOperationResult> {
  switch (operation.kind) {
    case 'checkout':
      return checkoutRef(run, operation.ref)
    case 'checkoutRevision':
      return checkoutRevision(run, operation.commit)
    case 'createBranch':
      return createBranch(run, operation.name, operation.startPoint, operation.checkout)
    case 'renameBranch':
      return renameBranch(run, operation.from, operation.to)
    case 'deleteBranch':
      return deleteBranch(run, operation.name, operation.force)
    case 'deleteRemoteBranch':
      return deleteRemoteBranch(run, operation.remote, operation.branch)
    case 'merge':
      return mergeRef(run, operation.ref)
    case 'rebase':
      return rebaseOnto(run, operation.onto)
    case 'checkoutAndRebase':
      return checkoutAndRebase(run, operation.branch, operation.onto)
    case 'updateBranch':
      return updateBranch(run, operation.branch)
    case 'pushBranch':
      return pushBranch(run, operation.branch)
    case 'fetchAll':
      return fetchAllRemotes(run)
    case 'cherryPick':
      return cherryPick(run, operation.commit)
    case 'createTag':
      return createTag(run, operation.name, operation.commit, operation.message)
  }
}

/** Run one Git page operation in the worktree at `cwd`; a refused input reads as a failure. */
export async function runGitLogOperation(
  git: GitHistoryExecutor,
  cwd: string,
  operation: GitLogOperation
): Promise<GitLogOperationResult> {
  try {
    return await dispatch({ git, cwd }, operation)
  } catch (error) {
    return failed(error instanceof Error ? error.message : String(error))
  }
}
