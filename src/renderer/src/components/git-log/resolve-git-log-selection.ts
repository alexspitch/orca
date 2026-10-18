import type { Repo } from '../../../../shared/repo-types'
import type { Worktree } from '../../../../shared/worktree/types'
import { isFolderRepo } from '../../../../shared/repo-kind'

export type GitLogSelectionInput = {
  repos: readonly Repo[]
  worktreesByRepo: Readonly<Record<string, readonly Worktree[] | undefined>>
  /** Settings › Git › Default project. */
  defaultRepoId: string | null | undefined
  activeWorktree: Pick<Worktree, 'id' | 'repoId'> | null
  lastRepoId: string | null
  lastWorktreeByRepo: Readonly<Record<string, string>>
  /** What was picked in the page header since it opened. */
  pickedRepoId: string | null
  pickedWorktreeId: string | null
}

export type GitLogSelection = { repo: Repo | null; worktree: Worktree | null }

/** Projects the Git page offers: folder workspaces have no log. */
export function gitLogRepos(repos: readonly Repo[]): Repo[] {
  return repos.filter((repo) => !isFolderRepo(repo))
}

/**
 * Project: a header pick, then the default from Settings, the active worktree's project, the
 * last one opened here, the first. Worktree: a header pick, the active one when it belongs to
 * that project, the last one picked for it, its main checkout, the first.
 */
export function resolveGitLogSelection(input: GitLogSelectionInput): GitLogSelection {
  const repos = gitLogRepos(input.repos)
  const repoById = (id: string | null | undefined): Repo | undefined =>
    id ? repos.find((repo) => repo.id === id) : undefined
  const repo =
    repoById(input.pickedRepoId) ??
    repoById(input.defaultRepoId) ??
    repoById(input.activeWorktree?.repoId) ??
    repoById(input.lastRepoId) ??
    repos[0]
  if (!repo) {
    return { repo: null, worktree: null }
  }
  const worktrees = input.worktreesByRepo[repo.id] ?? []
  const worktreeById = (id: string | null | undefined): Worktree | undefined =>
    id ? worktrees.find((worktree) => worktree.id === id) : undefined
  const activeHere = input.activeWorktree?.repoId === repo.id ? input.activeWorktree.id : null
  const worktree =
    worktreeById(input.pickedWorktreeId) ??
    worktreeById(activeHere) ??
    worktreeById(input.lastWorktreeByRepo[repo.id]) ??
    worktrees.find((candidate) => candidate.isMainWorktree) ??
    worktrees[0] ??
    null
  return { repo, worktree }
}
