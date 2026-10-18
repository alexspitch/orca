import type { GitRefEntry } from '../../../../shared/git-log-page-types'

export type GitLogBranchActionId =
  | 'showInLog'
  | 'checkout'
  | 'newBranch'
  | 'checkoutAndRebase'
  | 'compare'
  | 'diffWorkingTree'
  | 'rebaseOnto'
  | 'merge'
  | 'update'
  | 'push'
  | 'rename'
  | 'delete'

export type GitLogCommitActionId =
  | 'copyRevision'
  | 'cherryPick'
  | 'checkoutRevision'
  | 'showRepository'
  | 'compareWithLocal'
  | 'newBranch'
  | 'newTag'
  | 'child'
  | 'parent'
  | 'openInBrowser'
  | 'explain'

export type GitLogMenuLayout<T extends string> = (T | 'separator')[]

// Why: hiding items can leave separators back to back or at an edge.
function tidy<T extends string>(items: GitLogMenuLayout<T>): GitLogMenuLayout<T> {
  const out: GitLogMenuLayout<T> = []
  for (const item of items) {
    if (item === 'separator' && (out.length === 0 || out.at(-1) === 'separator')) {
      continue
    }
    out.push(item)
  }
  return out.at(-1) === 'separator' ? out.slice(0, -1) : out
}

/**
 * WebStorm's branch menu for one ref, in its order. Only what applies shows: the current branch
 * can't be checked out, merged or deleted; a host without write support offers Show in Log only.
 */
export function gitLogBranchMenu(
  ref: GitRefEntry,
  currentBranch: string | null,
  canWrite: boolean
): GitLogMenuLayout<GitLogBranchActionId> {
  if (!canWrite) {
    return ['showInLog']
  }
  if (ref.kind === 'tag') {
    return tidy([
      'showInLog',
      'separator',
      'checkout',
      'newBranch',
      'separator',
      'compare',
      'diffWorkingTree'
    ])
  }
  if (ref.kind === 'remote') {
    return tidy([
      'showInLog',
      'separator',
      'checkout',
      'newBranch',
      'separator',
      'compare',
      'diffWorkingTree',
      'separator',
      'rebaseOnto',
      'merge',
      'separator',
      'delete'
    ])
  }
  if (ref.shortName === currentBranch) {
    return tidy([
      'showInLog',
      'separator',
      'newBranch',
      'separator',
      'diffWorkingTree',
      'separator',
      'update',
      'push',
      'separator',
      'rename'
    ])
  }
  return tidy([
    'showInLog',
    'separator',
    'checkout',
    'newBranch',
    ...(currentBranch ? (['checkoutAndRebase'] as const) : []),
    'separator',
    'compare',
    'diffWorkingTree',
    'separator',
    'rebaseOnto',
    'merge',
    'separator',
    'update',
    'push',
    'separator',
    'rename',
    'delete'
  ])
}

/** The commit menu: WebStorm's reading items and the six operations; the rest stays hidden. */
export function gitLogCommitMenu(canWrite: boolean): GitLogMenuLayout<GitLogCommitActionId> {
  return tidy([
    'copyRevision',
    ...(canWrite ? (['cherryPick'] as const) : []),
    'separator',
    ...(canWrite ? (['checkoutRevision', 'showRepository', 'compareWithLocal'] as const) : []),
    'separator',
    ...(canWrite ? (['newBranch', 'newTag'] as const) : []),
    'separator',
    'child',
    'parent',
    'separator',
    'openInBrowser',
    'explain'
  ])
}
