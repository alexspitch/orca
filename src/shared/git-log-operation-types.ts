/** A repository change the Git page asks its host to make, in the picked worktree. */
export type GitLogOperation =
  /** A local branch (`main`), a remote one (`origin/main`, tracked locally) or a tag (detached). */
  | { kind: 'checkout'; ref: GitLogRefTarget }
  | { kind: 'checkoutRevision'; commit: string }
  | { kind: 'createBranch'; name: string; startPoint: string; checkout: boolean }
  | { kind: 'renameBranch'; from: string; to: string }
  | { kind: 'deleteBranch'; name: string; force: boolean }
  | { kind: 'deleteRemoteBranch'; remote: string; branch: string }
  | { kind: 'merge'; ref: string }
  | { kind: 'rebase'; onto: string }
  | { kind: 'checkoutAndRebase'; branch: string; onto: string }
  | { kind: 'updateBranch'; branch: string }
  | { kind: 'pushBranch'; branch: string }
  | { kind: 'fetchAll' }
  | { kind: 'cherryPick'; commit: string }
  | { kind: 'createTag'; name: string; commit: string; message?: string }

export type GitLogRefTarget =
  | { kind: 'local'; name: string }
  | { kind: 'remote'; name: string }
  | { kind: 'tag'; name: string }

export type GitLogConflictOperation = 'merge' | 'rebase' | 'cherry-pick'

export type GitLogOperationResult =
  | { status: 'done'; message?: string }
  /** Git keeps a branch in one worktree; this one belongs to the worktree at `worktreePath`. */
  | { status: 'branch-in-worktree'; branch: string; worktreePath: string }
  /** `branch -d` refused: deleting would lose commits; ask before `-D`. */
  | { status: 'not-fully-merged'; branch: string }
  /** It stopped on conflicts and was aborted, leaving the worktree as it was. */
  | { status: 'conflict-aborted'; operation: GitLogConflictOperation; files: string[] }
  | { status: 'failed'; message: string }

export type GitLogChangedPath = {
  path: string
  oldPath?: string
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'copied'
}

export type GitLogTreeAtRevision = {
  paths: string[]
  /** More files exist than were listed. */
  truncated: boolean
}

export const GIT_LOG_TREE_MAX_PATHS = 100_000
