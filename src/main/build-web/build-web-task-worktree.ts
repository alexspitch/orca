import type { Repo } from '../../shared/repo-types'
import type { Worktree } from '../../shared/worktree/types'
import type {
  WorktreeBuildWebTask,
  WorktreeBuildWebTaskRequest
} from '../../shared/build-web-session-types'
import { sameBuildWebConsole } from '../../shared/build-web-console-origin'
import { isFolderRepo } from '../../shared/repo-kind'
import { projectGroupIdFromRepoId } from '../../shared/folder-workspace-worktree'

type TaskWorktreeRuntime = {
  showManagedWorktree: (
    selector: string
  ) => Promise<Pick<Worktree, 'isMainWorktree' | 'repoId' | 'branch' | 'buildWebTask'>>
  showRepo: (selector: string) => Promise<Pick<Repo, 'kind'>>
}

const LOCAL_BRANCH = /^refs\/heads\//

/**
 * A client's request to link a worktree to a build-web task (IS-147), on the host's terms: only a
 * git worktree Orca made, never the main checkout or a folder. The branch Orca may delete and the
 * console session are the host's — a client never names them.
 */
export async function hostBuildWebTaskLink(
  runtime: TaskWorktreeRuntime,
  selector: string,
  request: WorktreeBuildWebTaskRequest
): Promise<WorktreeBuildWebTask> {
  const worktree = await runtime.showManagedWorktree(selector)
  if (worktree.isMainWorktree) {
    throw new Error('A build-web task is never linked to the main worktree.')
  }
  const folder =
    projectGroupIdFromRepoId(worktree.repoId) !== null ||
    isFolderRepo(await runtime.showRepo(`id:${worktree.repoId}`))
  if (folder) {
    throw new Error('A build-web task is linked to a git worktree, not a folder workspace.')
  }
  const link = { issueId: request.issueId, key: request.key, consoleHost: request.consoleHost }
  const existing = worktree.buildWebTask
  const sameTask =
    existing?.issueId === request.issueId &&
    sameBuildWebConsole(existing.consoleHost, request.consoleHost)
  if (existing?.sessionId && !sameTask) {
    throw new Error("This worktree holds another task's session. Keep it first.")
  }
  const branch = existing?.branch ?? worktree.branch.replace(LOCAL_BRANCH, '')
  if (!branch) {
    throw new Error('A build-web task is linked to a worktree on a branch, not a detached HEAD.')
  }
  return existing?.sessionId
    ? { ...link, branch, sessionId: existing.sessionId }
    : { ...link, branch }
}
