import type { BuildWebSessionAttentionReason } from '../../shared/build-web-session-types'
import type { WorkspaceCleanupBlocker } from '../../shared/workspace-cleanup'

// «Is the container empty?» for a closed task's worktree (IS-147). Orca removes only a worktree
// that still sits on the branch Orca made, with nothing on it the base lacks and nothing uncommitted.

export type BuildWebEmptyContainerVerdict =
  | { kind: 'empty'; head: BuildWebWorktreeHead }
  /** Pinned worktrees are never removed and never need attention: they stay «closing». */
  | { kind: 'pinned' }
  /** Not knowable now (a fetch or `git status` failed); asked again next time. */
  | { kind: 'wait' }
  | {
      kind: 'attention'
      reason: Extract<
        BuildWebSessionAttentionReason,
        'head-moved' | 'commits' | 'dirty' | 'blocked'
      >
      detail?: string
    }

export type BuildWebWorktreeHead = { ref: string | null; sha: string }

export type BuildWebEmptyContainerProbe<Base extends { ref: string } = { ref: string }> = {
  isPinned: boolean
  /** The branch Orca created for the task (`buildWebTask.branch`). */
  branch: string
  readHead: () => Promise<BuildWebWorktreeHead | null>
  /** The remote-tracking base, or null when the base is not one. */
  resolveBase: () => Promise<Base | null>
  /** Fetch the base; false when the fetch failed. */
  refreshBase: (base: Base) => Promise<boolean>
  /** `git rev-list --count base..branch`, or null when Git could not say. */
  countCommits: (baseRef: string, branchRef: string) => Promise<number | null>
  /** The workspace cleanup scan's blockers for this worktree, or null when it has no row. */
  scanBlockers: () => Promise<readonly WorkspaceCleanupBlocker[] | null>
}

const SHORT_BRANCH = /^refs\/heads\//

export async function checkBuildWebEmptyContainer<Base extends { ref: string }>(
  probe: BuildWebEmptyContainerProbe<Base>
): Promise<BuildWebEmptyContainerVerdict> {
  if (probe.isPinned) {
    return { kind: 'pinned' }
  }
  const head = await probe.readHead()
  if (!head) {
    return { kind: 'wait' }
  }
  const branchRef = `refs/heads/${probe.branch}`
  if (head.ref !== branchRef) {
    return {
      kind: 'attention',
      reason: 'head-moved',
      detail: head.ref ? head.ref.replace(SHORT_BRANCH, '') : 'detached HEAD'
    }
  }
  const base = await probe.resolveBase()
  if (!base) {
    return { kind: 'attention', reason: 'blocked', detail: 'unknown-base' }
  }
  if (!(await probe.refreshBase(base))) {
    return { kind: 'wait' }
  }
  const commits = await probe.countCommits(base.ref, branchRef)
  if (commits === null) {
    return { kind: 'wait' }
  }
  if (commits > 0) {
    return { kind: 'attention', reason: 'commits', detail: String(commits) }
  }
  const blockers = (await probe.scanBlockers())?.filter((blocker) => blocker !== 'pinned')
  if (!blockers || blockers.includes('git-status-error')) {
    return { kind: 'wait' }
  }
  if (blockers.includes('dirty-files')) {
    return { kind: 'attention', reason: 'dirty' }
  }
  if (blockers.includes('unpushed-commits')) {
    return { kind: 'attention', reason: 'commits' }
  }
  if (blockers.length > 0) {
    return { kind: 'attention', reason: 'blocked', detail: blockers.join(', ') }
  }
  return { kind: 'empty', head }
}
