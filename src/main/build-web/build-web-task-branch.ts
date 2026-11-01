import type {
  WorktreeBuildWebTask,
  WorktreeBuildWebTaskRequest
} from '../../shared/build-web-session-types'
import { gitExecFileAsync } from '../git/runner'
import { listWorktreesStrict } from '../git/worktree'
import { forceDeleteLocalBranch } from '../git/worktree-branch-removal'
import type { LocalGitExecOptions } from '../git/repo-default-base-ref'

// «Take to work» names a task worktree's branch the way the console does (IS-147): one branch per
// task, the one the skill works in. The folder keeps `is-<n>`; the branch is `<KEY>-<title slug>`.

/** The console's work branch a create may take: only the task's own `<KEY>-…`, else null. */
export function taskWorkBranchOf(task: WorktreeBuildWebTaskRequest | undefined): string | null {
  const branch = task?.workBranch?.trim()
  if (!task || !branch) {
    return null
  }
  // Why the key: a client must not make Orca take, and later delete, `master` or another task's branch.
  const ownBranch =
    branch.startsWith(`${task.key}-`) && branch.length > task.key.length + 1 && !/\s/.test(branch)
  if (!ownBranch) {
    console.warn(`[build-web] ${task.key}: work branch "${branch}" is not the task's, ignored`)
    return null
  }
  return branch
}

/** What a create records: the task link and the branch it checked out; `workBranch` was only a request. */
export function createdBuildWebTask(
  request: WorktreeBuildWebTaskRequest,
  branch: string
): WorktreeBuildWebTask {
  return { issueId: request.issueId, key: request.key, consoleHost: request.consoleHost, branch }
}

/** The task branch a create checks out, or makes from its base when `exists` is false. */
export type TaskWorkBranch = {
  name: string
  exists: boolean
  /** Drops the local copy this step made of the remote branch, after a create that failed. */
  rollback: () => Promise<void>
}

const noRollback = async (): Promise<void> => {}

// Why short: the person waits on «Take to work»; a slow remote leaves the refs it already has.
const TASK_BRANCH_FETCH_TIMEOUT_MS = 20_000

/**
 * The task branch as the repo has it, after fetching it from the remote: taken when free (fast-
 * forwarded when the remote went on, kept when it diverged), copied from `<remote>/<branch>` when
 * only the remote has it, refused when another worktree holds it.
 */
export async function prepareTaskWorkBranch(args: {
  repoPath: string
  branch: string
  /** The base's remote; else `origin`, or the repo's only remote. */
  remote: string | null
  gitOptions: LocalGitExecOptions
}): Promise<TaskWorkBranch | null> {
  const { repoPath, branch, gitOptions } = args
  const git = (argv: string[], timeout?: number) =>
    gitExecFileAsync(argv, { cwd: repoPath, ...gitOptions, ...(timeout ? { timeout } : {}) })
  const sha = async (ref: string): Promise<string | null> =>
    git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]).then(
      (result) => result.stdout.trim() || null,
      () => null
    )
  const valid =
    !branch.startsWith('-') &&
    (await git(['check-ref-format', '--branch', branch]).then(
      () => true,
      () => false
    ))
  if (!valid) {
    console.warn(`[build-web] work branch "${branch}" is not a valid branch name, ignored`)
    return null
  }
  // Why not prunable: a worktree whose folder is gone holds the branch only until Git prunes it.
  const holder = (await listWorktreesStrict(repoPath, gitOptions)).find(
    (worktree) => !worktree.prunable && worktree.branch.replace(/^refs\/heads\//, '') === branch
  )
  if (holder) {
    throw new Error(
      `The branch "${branch}" is checked out in ${holder.path}. Continue the task there, or switch that worktree off the branch.`
    )
  }
  const remote = args.remote ?? (await defaultRemote(git))
  const remoteRef = remote ? `refs/remotes/${remote}/${branch}` : null
  if (remote && remoteRef) {
    // Why fetch: the task may have gone on from another host; a missing branch or no network is not an error.
    await git(
      ['fetch', '--no-tags', '--quiet', remote, `+refs/heads/${branch}:${remoteRef}`],
      TASK_BRANCH_FETCH_TIMEOUT_MS
    ).catch(() => {})
  }
  const localSha = await sha(`refs/heads/${branch}`)
  const remoteSha = remoteRef ? await sha(remoteRef) : null
  if (localSha) {
    const behind =
      remoteSha !== null &&
      remoteSha !== localSha &&
      (await git(['merge-base', '--is-ancestor', localSha, remoteSha]).then(
        () => true,
        () => false
      ))
    if (!behind || !remoteSha) {
      if (remoteSha && remoteSha !== localSha) {
        console.warn(`[build-web] ${branch} differs from ${remote}; the local branch is kept`)
      }
      return { name: branch, exists: true, rollback: noRollback }
    }
    await git(['update-ref', `refs/heads/${branch}`, remoteSha, localSha])
    return {
      name: branch,
      exists: true,
      rollback: () =>
        git(['update-ref', `refs/heads/${branch}`, localSha, remoteSha]).then(
          () => {},
          (error: unknown) => console.warn(`[build-web] could not move ${branch} back:`, error)
        )
    }
  }
  if (!remoteSha || !remoteRef) {
    return { name: branch, exists: false, rollback: noRollback }
  }
  // Why --no-track: like any branch Orca makes; the skill pushes it with its own upstream.
  await git(['branch', '--no-track', '--', branch, remoteRef])
  return {
    name: branch,
    exists: true,
    rollback: () =>
      forceDeleteLocalBranch(repoPath, branch, remoteSha, undefined, gitOptions).catch(
        (error: unknown) => console.warn(`[build-web] could not drop branch ${branch}:`, error)
      )
  }
}

async function defaultRemote(
  git: (argv: string[]) => Promise<{ stdout: string }>
): Promise<string | null> {
  const remotes = await git(['remote']).then(
    (result) =>
      result.stdout
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    (): string[] => []
  )
  return remotes.includes('origin') ? 'origin' : remotes.length === 1 ? remotes[0] : null
}
