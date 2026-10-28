import type { Repo } from '../../../../shared/repo-types'
import type { Worktree } from '../../../../shared/worktree/types'
import {
  defaultTakeToWorkWorktree as defaultWorktreeOf,
  takeToWorkCandidates as candidatesOf,
  type BatchCheck
} from '../../../../shared/build-web-take-to-work'
import { translate } from '@/i18n/i18n'

export {
  MAX_INSTRUCTION,
  isChatPlatformBatch,
  takeToWorkPrompt,
  takeToWorkRepos,
  takenWorktreeNames,
  taskWorktreeName,
  taskWorktreeTitle,
  validateBuildWebBatch,
  type BatchCheck,
  type TakeToWorkFlags
} from '../../../../shared/build-web-take-to-work'

/** Why the selection cannot go, in words; null when it can (or is merely empty). */
export function batchCheckMessage(check: BatchCheck): string | null {
  if (check.ok || check.reason === 'empty') {
    return null
  }
  const groups = check.groups.join(', ')
  switch (check.reason) {
    case 'too-many':
      return translate(
        'buildWeb.take.oneTask',
        'Take to work takes one task at a time: select just one.'
      )
    case 'bad-key':
      return translate('buildWeb.take.badKey', 'These keys cannot be sent: {{keys}}', {
        keys: groups
      })
    case 'unknown-product':
      return translate(
        'buildWeb.take.unknownProduct',
        'Orca does not know the product of {{keys}}.',
        {
          keys: groups
        }
      )
  }
}

/** Live git worktrees of the build-web repository (by folder name), or every live one if none match. */
export const takeToWorkCandidates = (
  repos: readonly Repo[],
  worktreesByRepo: Record<string, Worktree[] | undefined>
): { worktrees: Worktree[]; matchedRepo: boolean } =>
  candidatesOf(repos, (repo) => worktreesByRepo[repo.id] ?? [])

/** The active worktree when it is a candidate, else the last one used, else the first. */
export const defaultTakeToWorkWorktree = (
  candidates: Worktree[],
  activeWorktreeId: string | null,
  lastUsedId: string | null
): string | null =>
  defaultWorktreeOf(
    candidates.map((w) => w.id),
    activeWorktreeId,
    lastUsedId
  )
