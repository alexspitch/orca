import { readGitCommandFailureText } from './git-command-failure-text'
import type { GitLogOperationResult } from './git-log-operation-types'
import {
  assertGitLogRef,
  currentBranch,
  done,
  failed,
  worktreeHolding,
  type GitLogRun
} from './git-log-operation-outcome'
import { resolveConfiguredGitPushTarget } from './git-push-target-resolution'
import { normalizeGitErrorMessage } from './git-remote-error'

type Upstream = { remote: string; mergeRef: string }

async function configValue(run: GitLogRun, key: string): Promise<string | null> {
  try {
    const { stdout } = await run.git(['config', '--get', key], run.cwd)
    return stdout.trim() || null
  } catch {
    return null
  }
}

async function upstreamOf(run: GitLogRun, branch: string): Promise<Upstream | null> {
  const [remote, mergeRef] = await Promise.all([
    configValue(run, `branch.${branch}.remote`),
    configValue(run, `branch.${branch}.merge`)
  ])
  return remote && mergeRef ? { remote, mergeRef } : null
}

async function defaultRemote(run: GitLogRun): Promise<string | null> {
  try {
    const { stdout } = await run.git(['remote'], run.cwd)
    const remotes = stdout.split(/\r?\n/).filter(Boolean)
    return remotes.includes('origin') ? 'origin' : (remotes[0] ?? null)
  } catch {
    return null
  }
}

/** WebStorm's Update: bring a branch up to its upstream, fast-forward only. */
export async function updateBranch(run: GitLogRun, branch: string): Promise<GitLogOperationResult> {
  assertGitLogRef(branch)
  const upstream = await upstreamOf(run, branch)
  if (!upstream) {
    return failed(`“${branch}” has no upstream branch to update from.`)
  }
  // Why not pull there: another worktree's Git work is serialized by its own lock, not this one.
  const holder = await worktreeHolding(run, branch)
  if (holder) {
    return { status: 'branch-in-worktree', branch, worktreePath: holder }
  }
  const isCurrent = (await currentBranch(run)) === branch
  try {
    await (isCurrent
      ? // Why pull.rebase off: before Git 2.34 it outranks --ff-only and would rebase.
        run.git(['-c', 'pull.rebase=false', 'pull', '--ff-only'], run.cwd)
      : run.git(['fetch', upstream.remote, `${upstream.mergeRef}:refs/heads/${branch}`], run.cwd))
    return done()
  } catch (error) {
    if (
      /non-fast-forward|not possible to fast-forward|rejected/i.test(
        readGitCommandFailureText(error)
      )
    ) {
      return failed(
        `“${branch}” has diverged from its upstream and can’t be fast-forwarded. Merge or rebase it instead.`
      )
    }
    return failed(normalizeGitErrorMessage(error, isCurrent ? 'pull' : 'fetch'))
  }
}

/**
 * Push a local branch where Source Control's Push would send it were the branch checked out:
 * Orca's push-target rules (pushRemote, pushDefault, never onto a different upstream branch such
 * as origin/main), else publish it under its own name and track that.
 */
export async function pushBranch(run: GitLogRun, branch: string): Promise<GitLogOperationResult> {
  assertGitLogRef(branch)
  const local = `refs/heads/${branch}`
  try {
    // Why the stand-in: the resolver reads HEAD's branch; this branch need not be checked out.
    const target = await resolveConfiguredGitPushTarget((args) =>
      args.join(' ') === 'symbolic-ref --quiet --short HEAD'
        ? Promise.resolve({ stdout: `${branch}\n` })
        : run.git(args, run.cwd)
    )
    const remote = target?.remote ?? (await defaultRemote(run))
    if (!remote) {
      return failed('This repository has no remote to push to.')
    }
    const destination = target?.refspec.startsWith('HEAD:')
      ? `refs/heads/${target.refspec.slice('HEAD:'.length)}`
      : local
    await run.git(['push', '--set-upstream', remote, `${local}:${destination}`], run.cwd)
    return done()
  } catch (error) {
    return failed(normalizeGitErrorMessage(error, 'push'))
  }
}

export async function deleteRemoteBranch(
  run: GitLogRun,
  remote: string,
  branch: string
): Promise<GitLogOperationResult> {
  assertGitLogRef(remote)
  assertGitLogRef(branch)
  try {
    await run.git(['push', remote, '--delete', branch], run.cwd)
    return done()
  } catch (error) {
    return failed(normalizeGitErrorMessage(error, 'push'))
  }
}

export async function fetchAllRemotes(run: GitLogRun): Promise<GitLogOperationResult> {
  try {
    await run.git(['fetch', '--all', '--prune'], run.cwd)
    return done()
  } catch (error) {
    return failed(normalizeGitErrorMessage(error, 'fetch'))
  }
}
