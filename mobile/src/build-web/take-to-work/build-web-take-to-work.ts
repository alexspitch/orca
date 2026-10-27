import type { BuildWebIssueRow } from '../../../../src/shared/build-web-types'
import {
  defaultTakeToWorkWorktree as defaultWorktreeOf,
  takeToWorkCandidates as candidatesOf,
  validateBuildWebBatch as validateBatch,
  type BatchCheck
} from '../../../../src/shared/build-web-take-to-work'
import { productLabel } from '../build-web-labels'

export {
  MAX_INSTRUCTION,
  batchWorktreeName,
  buildWebBatchPrompt,
  isChatPlatformBatch,
  takeToWorkRepos,
  type TakeToWorkFlags
} from '../../../../src/shared/build-web-take-to-work'

/** What the host's repo.list tells about a repository, as far as taking tasks needs it. */
export type TakeToWorkRepo = {
  id: string
  path: string
  displayName: string
  kind?: 'git' | 'folder'
  worktreeBaseRef?: string | null
  /** Runs over SSH or in a WSL distro, where a launch cannot name another Claude account. */
  ownLogin?: boolean
}

/** A host workspace row, as far as taking tasks needs it. */
export type TakeToWorkWorktree = {
  worktreeId: string
  repoId: string
  displayName: string
  branch?: string
  hostId?: string
  isArchived?: boolean
}

/** One product and one release per batch: the skill and the train are chosen by both. */
export const validateBuildWebBatch = (issues: readonly BuildWebIssueRow[]): BatchCheck =>
  validateBatch(issues, productLabel)

/** Why the batch cannot go, in words; null when it can (or is merely empty). */
export function batchCheckMessage(check: BatchCheck): string | null {
  if (check.ok || check.reason === 'empty') {
    return null
  }
  const groups = check.groups.join(', ')
  switch (check.reason) {
    case 'mixed':
      return `Tasks of different products or releases: ${groups}`
    case 'too-many':
      return 'At most 20 tasks at once.'
    case 'bad-key':
      return `These keys cannot be sent: ${groups}`
    case 'unknown-product':
      return `Orca does not know the product of ${groups}.`
  }
}

/** Live git worktrees of the build-web repository (by folder name), or every live one if none match. */
export const takeToWorkCandidates = <W extends TakeToWorkWorktree>(
  repos: readonly TakeToWorkRepo[],
  worktrees: readonly W[]
): { worktrees: W[]; matchedRepo: boolean } =>
  candidatesOf(repos, (repo) => worktrees.filter((w) => w.repoId === repo.id))

/** The active worktree when it is a candidate, else the last one used, else the first. */
export const defaultTakeToWorkWorktree = (
  candidates: readonly TakeToWorkWorktree[],
  activeWorktreeId: string | null,
  lastUsedId: string | null
): string | null =>
  defaultWorktreeOf(
    candidates.map((w) => w.worktreeId),
    activeWorktreeId,
    lastUsedId
  )

// Why per host and in memory: the desktop's store remembers it per window the same way.
const lastUsedByHost = new Map<string, string>()

export const lastTakeToWorkWorktree = (hostId: string): string | null =>
  lastUsedByHost.get(hostId) ?? null

export function rememberTakeToWorkWorktree(hostId: string, worktreeId: string): void {
  lastUsedByHost.set(hostId, worktreeId)
}
