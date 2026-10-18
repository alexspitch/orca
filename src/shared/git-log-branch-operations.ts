import { readGitCommandFailureText } from './git-command-failure-text'
import type { GitLogOperationResult, GitLogRefTarget } from './git-log-operation-types'
import {
  abortStoppedOperation,
  assertGitLogRef,
  done,
  failed,
  gitFailureMessage,
  heldBranchPath,
  isFullOid,
  headPosition,
  isValidRefName,
  refExists,
  returnToPosition,
  stoppedWorkIssue,
  worktreeHolding,
  type GitLogRun
} from './git-log-operation-outcome'
import { splitRemoteBranchName } from './git-remote-branch-name'

export async function checkoutLocalBranch(
  run: GitLogRun,
  branch: string
): Promise<GitLogOperationResult> {
  assertGitLogRef(branch)
  const holder = await worktreeHolding(run, branch)
  if (holder) {
    return { status: 'branch-in-worktree', branch, worktreePath: holder }
  }
  try {
    await run.git(['checkout', branch, '--'], run.cwd)
    return done()
  } catch (error) {
    const heldAt = heldBranchPath(error)
    return heldAt
      ? { status: 'branch-in-worktree', branch, worktreePath: heldAt }
      : failed(gitFailureMessage(error))
  }
}

async function checkoutDetached(run: GitLogRun, revision: string): Promise<GitLogOperationResult> {
  try {
    await run.git(['checkout', '--detach', revision], run.cwd)
    return done()
  } catch (error) {
    return failed(gitFailureMessage(error))
  }
}

/** WebStorm's Checkout: a remote branch is checked out as a local branch that tracks it. */
export async function checkoutRef(
  run: GitLogRun,
  ref: GitLogRefTarget
): Promise<GitLogOperationResult> {
  assertGitLogRef(ref.name)
  if (ref.kind === 'local') {
    return checkoutLocalBranch(run, ref.name)
  }
  if (ref.kind === 'tag') {
    return checkoutDetached(run, `refs/tags/${ref.name}`)
  }
  const split = splitRemoteBranchName(ref.name)
  if (!split) {
    return failed(`Not a remote branch: ${ref.name}`)
  }
  if (await refExists(run, `refs/heads/${split.branchName}`)) {
    return checkoutLocalBranch(run, split.branchName)
  }
  try {
    await run.git(
      ['checkout', '-b', split.branchName, '--track', `refs/remotes/${ref.name}`],
      run.cwd
    )
    return done()
  } catch (error) {
    return failed(gitFailureMessage(error))
  }
}

export async function checkoutRevision(
  run: GitLogRun,
  commit: string
): Promise<GitLogOperationResult> {
  if (!isFullOid(commit)) {
    return failed(`Not a commit: ${commit}`)
  }
  return checkoutDetached(run, commit)
}

export async function createBranch(
  run: GitLogRun,
  name: string,
  startPoint: string,
  checkout: boolean
): Promise<GitLogOperationResult> {
  if (!(await isValidRefName(run, name, 'branch'))) {
    return failed(`“${name}” is not a valid branch name.`)
  }
  if (!isFullOid(startPoint)) {
    assertGitLogRef(startPoint)
  }
  if (await refExists(run, `refs/heads/${name}`)) {
    return failed(`A branch named “${name}” already exists.`)
  }
  try {
    await run.git(['branch', '--no-track', name, startPoint], run.cwd)
  } catch (error) {
    return failed(gitFailureMessage(error))
  }
  return checkout ? checkoutLocalBranch(run, name) : done()
}

export async function renameBranch(
  run: GitLogRun,
  from: string,
  to: string
): Promise<GitLogOperationResult> {
  assertGitLogRef(from)
  if (!(await isValidRefName(run, to, 'branch'))) {
    return failed(`“${to}” is not a valid branch name.`)
  }
  try {
    await run.git(['branch', '-m', from, to], run.cwd)
    return done()
  } catch (error) {
    return failed(gitFailureMessage(error))
  }
}

export async function deleteBranch(
  run: GitLogRun,
  name: string,
  force: boolean
): Promise<GitLogOperationResult> {
  assertGitLogRef(name)
  try {
    await run.git(['branch', force ? '-D' : '-d', name], run.cwd)
    return done()
  } catch (error) {
    if (!force && /not fully merged/i.test(readGitCommandFailureText(error))) {
      return { status: 'not-fully-merged', branch: name }
    }
    return failed(gitFailureMessage(error))
  }
}

export async function mergeRef(run: GitLogRun, ref: string): Promise<GitLogOperationResult> {
  assertGitLogRef(ref)
  const issue = await stoppedWorkIssue(run)
  if (issue) {
    return issue
  }
  try {
    await run.git(['merge', '--no-edit', ref], run.cwd)
    return done()
  } catch (error) {
    return abortStoppedOperation(run, 'merge', error)
  }
}

export async function rebaseOnto(run: GitLogRun, onto: string): Promise<GitLogOperationResult> {
  assertGitLogRef(onto)
  const issue = await stoppedWorkIssue(run)
  if (issue) {
    return issue
  }
  try {
    await run.git(['rebase', onto], run.cwd)
    return done()
  } catch (error) {
    return abortStoppedOperation(run, 'rebase', error)
  }
}

/** WebStorm's "Checkout and Rebase onto": `rebase <onto> <branch>` checks the branch out first. */
export async function checkoutAndRebase(
  run: GitLogRun,
  branch: string,
  onto: string
): Promise<GitLogOperationResult> {
  assertGitLogRef(branch)
  assertGitLogRef(onto)
  const holder = await worktreeHolding(run, branch)
  if (holder) {
    return { status: 'branch-in-worktree', branch, worktreePath: holder }
  }
  const issue = await stoppedWorkIssue(run)
  if (issue) {
    return issue
  }
  const before = await headPosition(run)
  try {
    await run.git(['rebase', onto, branch], run.cwd)
    return done()
  } catch (error) {
    const result = await abortStoppedOperation(run, 'rebase', error)
    // Why: the abort leaves `branch` checked out; "undone" means back where the user was.
    await returnToPosition(run, before)
    return result
  }
}
