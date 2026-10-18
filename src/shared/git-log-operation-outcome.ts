import { readGitCommandFailureStderr, readGitCommandFailureText } from './git-command-failure-text'
import type { GitHistoryExecutor } from './git-history-types'
import { isSafeGitLogRef } from './git-log-page'
import type { GitLogConflictOperation, GitLogOperationResult } from './git-log-operation-types'
import { stripCredentialsFromMessage } from './git-remote-error'
import { parseWorktreeList } from './git-worktree-porcelain-parser'

/** Git, run in the picked worktree (`cwd`). */
export type GitLogRun = { git: GitHistoryExecutor; cwd: string }

const FULL_OID = /^(?:[0-9a-fA-F]{40}|[0-9a-fA-F]{64})$/

export const done = (message?: string): GitLogOperationResult =>
  message ? { status: 'done', message } : { status: 'done' }

export const failed = (message: string): GitLogOperationResult => ({ status: 'failed', message })

/** What git said went wrong: its last `fatal:`/`error:` line, else its last line. */
export function gitFailureMessage(error: unknown): string {
  const text = stripCredentialsFromMessage(
    readGitCommandFailureStderr(error) ?? readGitCommandFailureText(error)
  )
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  for (const line of lines.toReversed()) {
    const explained = /(?:fatal|error):\s*(.+)$/i.exec(line)
    if (explained?.[1]) {
      return explained[1]
    }
  }
  return lines.at(-1) ?? 'Git failed.'
}

export function isFullOid(value: string): boolean {
  return FULL_OID.test(value)
}

// Why: every name and ref below reaches git argv; one that looks like an option or a range must not.
export function assertGitLogRef(ref: string): void {
  if (!isSafeGitLogRef(ref)) {
    throw new Error(`Not a usable ref: ${ref}`)
  }
}

export async function refExists(run: GitLogRun, fullRef: string): Promise<boolean> {
  try {
    await run.git(['rev-parse', '--verify', '--quiet', '--end-of-options', fullRef], run.cwd)
    return true
  } catch {
    return false
  }
}

/** Git's own rule for a branch (`check-ref-format --branch`) or a full ref. */
export async function isValidRefName(
  run: GitLogRun,
  name: string,
  kind: 'branch' | 'tag'
): Promise<boolean> {
  if (!name.trim() || name.startsWith('-')) {
    return false
  }
  try {
    await run.git(
      kind === 'branch'
        ? ['check-ref-format', '--branch', name]
        : ['check-ref-format', `refs/tags/${name}`],
      run.cwd
    )
    return true
  } catch {
    return false
  }
}

export async function currentBranch(run: GitLogRun, cwd = run.cwd): Promise<string | null> {
  try {
    const { stdout } = await run.git(['symbolic-ref', '--quiet', '--short', 'HEAD'], cwd)
    return stdout.trim() || null
  } catch {
    return null
  }
}

/** The other worktree that has `branch` checked out, if any. */
export async function worktreeHolding(run: GitLogRun, branch: string): Promise<string | null> {
  if ((await currentBranch(run)) === branch) {
    return null
  }
  try {
    const { stdout } = await run.git(['worktree', 'list', '--porcelain'], run.cwd)
    const holder = parseWorktreeList(stdout).find(
      (worktree) => worktree.branch === `refs/heads/${branch}`
    )
    return holder?.path ?? null
  } catch {
    return null
  }
}

/** Git's own refusal to check out a branch another worktree holds: the path it names. */
export function heldBranchPath(error: unknown): string | null {
  const held = /already (?:checked out|used by worktree) at '([^']+)'/i.exec(
    readGitCommandFailureText(error)
  )
  return held?.[1] ?? null
}

async function unmergedFiles(run: GitLogRun): Promise<string[]> {
  try {
    const { stdout } = await run.git(['diff', '--name-only', '--diff-filter=U', '-z'], run.cwd)
    return [...new Set(stdout.split('\0').filter(Boolean))]
  } catch {
    return []
  }
}

/**
 * Unresolved conflicts or a merge, cherry-pick or revert left half done. A page operation that
 * stops must not start then: its abort would throw that work away too.
 */
export async function stoppedWorkIssue(run: GitLogRun): Promise<GitLogOperationResult | null> {
  if ((await unmergedFiles(run)).length > 0) {
    return failed('This worktree has unresolved conflicts. Resolve or abort them first.')
  }
  for (const head of ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD']) {
    if (await refExists(run, head)) {
      return failed(
        'A merge, cherry-pick or revert is already in progress in this worktree. Finish or abort it first.'
      )
    }
  }
  return null
}

/** Where HEAD is: the branch, or the commit when detached. */
export async function headPosition(run: GitLogRun): Promise<string | null> {
  const branch = await currentBranch(run)
  if (branch) {
    return branch
  }
  try {
    const { stdout } = await run.git(['rev-parse', '--verify', 'HEAD'], run.cwd)
    return stdout.trim() || null
  } catch {
    return null
  }
}

/** Puts HEAD back where `headPosition` found it; best effort. */
export async function returnToPosition(run: GitLogRun, position: string | null): Promise<void> {
  if (!position || (await headPosition(run)) === position) {
    return
  }
  const args = isFullOid(position)
    ? ['checkout', '--detach', position]
    : ['checkout', position, '--']
  await run.git(args, run.cwd).catch(() => undefined)
}

const IN_PROGRESS_HEAD: Record<GitLogConflictOperation, string> = {
  merge: 'MERGE_HEAD',
  rebase: 'REBASE_HEAD',
  'cherry-pick': 'CHERRY_PICK_HEAD'
}

/**
 * A merge, rebase or cherry-pick failed. If it stopped part-way (conflicts, or a cherry-pick that
 * turned out empty), abort it so the worktree is as it was, and say what happened.
 */
export async function abortStoppedOperation(
  run: GitLogRun,
  operation: GitLogConflictOperation,
  error: unknown
): Promise<GitLogOperationResult> {
  const files = await unmergedFiles(run)
  // Why rebase always: a stopped rebase on Git 2.25's apply backend may leave no REBASE_HEAD.
  const stopped =
    files.length > 0 ||
    operation === 'rebase' ||
    (await refExists(run, IN_PROGRESS_HEAD[operation]))
  if (stopped) {
    await run.git([operation, '--abort'], run.cwd).catch(() => undefined)
  }
  if (files.length > 0) {
    return { status: 'conflict-aborted', operation, files }
  }
  const text = readGitCommandFailureText(error)
  if (operation === 'cherry-pick' && /now empty|nothing to commit/i.test(text)) {
    return failed('The commit’s changes are already in this branch.')
  }
  return failed(gitFailureMessage(error))
}
