import type { Repo } from '../../shared/repo-types'
import type { Worktree } from '../../shared/worktree/types'
import { isFolderRepo } from '../../shared/repo-kind'
import { projectGroupIdFromRepoId } from '../../shared/folder-workspace-worktree'

type TaskWorktreeRuntime = {
  showManagedWorktree: (selector: string) => Promise<Pick<Worktree, 'isMainWorktree' | 'repoId'>>
  showRepo: (selector: string) => Promise<Pick<Repo, 'kind'>>
}

/** A build-web task (IS-147) belongs to a git worktree Orca made: never the main checkout or a folder. */
export async function assertBuildWebTaskWorktree(
  runtime: TaskWorktreeRuntime,
  selector: string
): Promise<void> {
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
}
