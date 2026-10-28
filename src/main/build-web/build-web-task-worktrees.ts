import {
  getRepoExecutionHostId,
  getRepoRoutingConnectionId,
  LOCAL_EXECUTION_HOST_ID
} from '../../shared/execution-host'
import type { WorktreeBuildWebTask } from '../../shared/build-web-session-types'
import { sameBuildWebConsole } from '../../shared/build-web-console-origin'
import { isFolderRepo } from '../../shared/repo-kind'
import { splitWorktreeId } from '../../shared/worktree/id'
import type { Store } from '../persistence'
import { readAllWorktreeMetaForHost } from '../persistence/host-qualified-worktree-meta'
import { listWorktreesStrictAllowingTrueEmpty } from '../git/worktree-listing'
import { areWorktreePathsEqual } from '../git/worktree-path-comparison'
import { isWorktreePathMissing } from '../worktree-removal-safety'
import { getLocalProjectWorktreeGitOptions } from '../project-runtime-git-options'
import type { ProjectRuntimeResolutionStore } from '../local-project-runtime-resolution'
import type { BuildWebTaskWorktreeRef } from './build-web-worktree-git-probe'

// This host's own «Take to work» worktrees (IS-147): local Git worktrees only. SSH and folder
// workspaces are never watched or cleaned up here.

export type BuildWebTaskWorktree = BuildWebTaskWorktreeRef & { task: WorktreeBuildWebTask }

export type BuildWebLinkedTaskWorktree = BuildWebTaskWorktree & {
  task: WorktreeBuildWebTask & { sessionId: string }
}

export function hasBuildWebSession(row: BuildWebTaskWorktree): row is BuildWebLinkedTaskWorktree {
  return Boolean(row.task.sessionId)
}

type TaskWorktreeStore = Pick<
  Store,
  'getRepos' | 'getAllWorktreeMeta' | 'getAllWorktreeMetaForHost'
>

/** The task worktrees whose sessions live on `consoleHost`, the console connected now. */
export function listLocalBuildWebTaskWorktrees(
  store: TaskWorktreeStore,
  consoleHost: string
): BuildWebTaskWorktree[] {
  const repos = store
    .getRepos()
    .filter(
      (repo) =>
        getRepoExecutionHostId(repo) === LOCAL_EXECUTION_HOST_ID &&
        !getRepoRoutingConnectionId(repo) &&
        !isFolderRepo(repo)
    )
  const rows: BuildWebTaskWorktree[] = []
  for (const [worktreeId, meta] of Object.entries(
    readAllWorktreeMetaForHost(store, LOCAL_EXECUTION_HOST_ID)
  )) {
    const task = meta.buildWebTask
    const parsed = splitWorktreeId(worktreeId)
    const repo = parsed ? repos.find((r) => r.id === parsed.repoId) : undefined
    if (!task || !sameBuildWebConsole(task.consoleHost, consoleHost) || !parsed || !repo) {
      continue
    }
    rows.push({ worktreeId, path: parsed.worktreePath, repo, meta, branch: task.branch, task })
  }
  return rows
}

/** Gone behind Orca's back: the folder is missing and Git no longer lists a live registration. */
export async function isBuildWebTaskWorktreeGone(
  store: ProjectRuntimeResolutionStore,
  row: BuildWebTaskWorktree
): Promise<boolean> {
  // Why only ENOENT/ENOTDIR: an unreadable folder (EACCES, a stalled mount) is not a removal.
  if (!(await isWorktreePathMissing(row.path))) {
    return false
  }
  const listed = await listWorktreesStrictAllowingTrueEmpty(
    row.repo.path,
    getLocalProjectWorktreeGitOptions(store, row.repo)
  ).catch(() => null)
  if (!listed) {
    return false
  }
  return !listed.some(
    (worktree) => areWorktreePathsEqual(worktree.path, row.path) && !worktree.prunable
  )
}
