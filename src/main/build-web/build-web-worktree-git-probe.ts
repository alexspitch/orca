import type { Repo } from '../../shared/repo-types'
import type { WorktreeMeta } from '../../shared/worktree/meta-types'
import type { Store } from '../persistence'
import { gitExecFileAsync } from '../git/runner'
import { getBaseRefDefault } from '../git/repo'
import { forceDeleteLocalBranch } from '../git/worktree'
import { scanWorkspaceCleanup } from '../ipc/workspace-cleanup-scan'
import { getLocalProjectWorktreeGitOptions } from '../project-runtime-git-options'
import type {
  RemoteFetchResult,
  RemoteTrackingBase
} from '../runtime/runtime-remote-fetch-controller'
import type { BuildWebEmptyContainerProbe } from './build-web-empty-container'

// The Git reads behind «is the container empty?» for one local task worktree (IS-147).

export type BuildWebWorktreeGitRuntime = {
  resolveRemoteTrackingBase: (
    repoPath: string,
    baseBranch: string,
    options: { wslDistro?: string }
  ) => Promise<RemoteTrackingBase | null>
  getOrStartRemoteTrackingBaseRefresh: (
    repoPath: string,
    base: RemoteTrackingBase,
    options: { wslDistro?: string }
  ) => Promise<RemoteFetchResult>
}

export type BuildWebTaskWorktreeRef = {
  worktreeId: string
  path: string
  repo: Repo
  meta: WorktreeMeta
  branch: string
}

export type BuildWebWorktreeGitProbe = BuildWebEmptyContainerProbe<RemoteTrackingBase> & {
  /** The top-most ignored entries (an ignored folder is one), or null when Git could not say. */
  readIgnored: () => Promise<string[] | null>
  /** The task branch's commit, or null when the branch is gone. */
  readTaskBranch: () => Promise<string | null>
  /** Proven: the task branch adds no commit to the remote-tracking base. */
  taskBranchAddsNothing: () => Promise<boolean>
  /** Deletes the task branch at `sha`; refused when it moved or is checked out somewhere. */
  deleteTaskBranch: (sha: string) => Promise<void>
}

export function createBuildWebWorktreeGitProbe(
  runtime: BuildWebWorktreeGitRuntime,
  store: Store,
  target: BuildWebTaskWorktreeRef
): BuildWebWorktreeGitProbe {
  const { repo, meta } = target
  const gitOptions = getLocalProjectWorktreeGitOptions(store, repo)
  const git = (argv: string[], cwd: string) => gitExecFileAsync(argv, { cwd, ...gitOptions })
  const branchRef = `refs/heads/${target.branch}`
  const resolveBase = async (): Promise<RemoteTrackingBase | null> => {
    const base =
      meta.baseRef ||
      meta.sparseBaseRef ||
      repo.worktreeBaseRef ||
      (await getBaseRefDefault(repo.path, gitOptions).catch(() => null))
    return base ? runtime.resolveRemoteTrackingBase(repo.path, base, gitOptions) : null
  }
  const refreshBase = async (base: RemoteTrackingBase): Promise<boolean> =>
    (await runtime.getOrStartRemoteTrackingBaseRefresh(repo.path, base, gitOptions)).ok
  const countCommits = async (baseRef: string, ref: string): Promise<number | null> => {
    try {
      const { stdout } = await git(['rev-list', '--count', `${baseRef}..${ref}`], repo.path)
      const count = Number.parseInt(stdout.trim(), 10)
      return Number.isFinite(count) ? count : null
    } catch {
      return null
    }
  }
  return {
    isPinned: meta.isPinned,
    branch: target.branch,
    readHead: async () => {
      try {
        const sha = (await git(['rev-parse', '--verify', 'HEAD'], target.path)).stdout.trim()
        // Why caught: `symbolic-ref -q` exits 1 on a detached HEAD.
        const ref = await git(['symbolic-ref', '-q', 'HEAD'], target.path).then(
          (result) => result.stdout.trim() || null,
          () => null
        )
        return sha ? { ref, sha } : null
      } catch {
        return null
      }
    },
    resolveBase,
    refreshBase,
    countCommits,
    scanBlockers: async () => {
      // Why this scan: it reads status the way Cleanup does (shared links, no ignored files).
      const scan = await scanWorkspaceCleanup(store, {
        worktreeId: target.worktreeId,
        refreshActivity: true
      }).catch(() => null)
      return scan?.candidates.find((c) => c.worktreeId === target.worktreeId)?.blockers ?? null
    },
    readIgnored: async () => {
      try {
        // Why --directory: an ignored folder is one entry, and Git does not walk into it.
        const { stdout } = await git(
          ['ls-files', '--others', '--ignored', '--exclude-standard', '--directory', '-z'],
          target.path
        )
        return stdout.split('\0').filter(Boolean)
      } catch {
        return null
      }
    },
    readTaskBranch: async () => {
      try {
        const verify = ['rev-parse', '--verify', '--quiet', `${branchRef}^{commit}`]
        return (await git(verify, repo.path)).stdout.trim() || null
      } catch {
        return null
      }
    },
    taskBranchAddsNothing: async () => {
      const base = await resolveBase().catch(() => null)
      if (!base) {
        return false
      }
      // Why a failed fetch is no bar: what the last fetched base holds was on the remote.
      await refreshBase(base).catch(() => false)
      return (await countCommits(base.ref, branchRef)) === 0
    },
    deleteTaskBranch: (sha) =>
      forceDeleteLocalBranch(repo.path, target.branch, sha, git, gitOptions)
  }
}
