import type { BuildWebIssueRow } from '../../../../shared/build-web-types'
import type { Repo } from '../../../../shared/repo-types'
import type { Worktree } from '../../../../shared/worktree/types'
import { isGitRepoKind } from '../../../../shared/repo-kind'
import { translate } from '@/i18n/i18n'
import { productLabel } from './build-web-labels'

// «Take to work»: which tasks may go together, where, and the one line the agent receives.

export const MAX_BATCH = 20
const KEY_RE = /^[A-Z][A-Z0-9]*-\d+(?:\.\d+)?$/

export type BatchCheck =
  | { ok: true }
  | {
      ok: false
      reason: 'empty' | 'mixed' | 'too-many' | 'bad-key' | 'unknown-product'
      groups: string[]
    }

const releaseOf = (issue: BuildWebIssueRow) => issue.version_name ?? '—'

/** One product and one release per batch: the skill and the train are chosen by both. */
export function validateBuildWebBatch(issues: BuildWebIssueRow[]): BatchCheck {
  if (issues.length === 0) {
    return { ok: false, reason: 'empty', groups: [] }
  }
  if (issues.length > MAX_BATCH) {
    return { ok: false, reason: 'too-many', groups: [] }
  }
  if (issues.some((issue) => !KEY_RE.test(issue.key))) {
    return {
      ok: false,
      reason: 'bad-key',
      groups: issues.filter((i) => !KEY_RE.test(i.key)).map((i) => i.key)
    }
  }
  // Why: the skill and the train are picked by product, so one Orca cannot name must not go.
  const unknown = issues.filter((issue) => issue.product === 'unknown')
  if (unknown.length) {
    return { ok: false, reason: 'unknown-product', groups: unknown.map((issue) => issue.key) }
  }
  const groups = new Map<string, { label: string; count: number }>()
  for (const issue of issues) {
    const key = `${issue.product}|${issue.version_id ?? ''}`
    const group = groups.get(key) ?? {
      label: `${productLabel(issue.product)} ${releaseOf(issue)}`,
      count: 0
    }
    groups.set(key, { ...group, count: group.count + 1 })
  }
  return groups.size > 1
    ? {
        ok: false,
        reason: 'mixed',
        groups: [...groups.values()].map((g) => `${g.label} (${g.count})`)
      }
    : { ok: true }
}

/** Why the batch cannot go, in words; null when it can (or is merely empty). */
export function batchCheckMessage(check: BatchCheck): string | null {
  if (check.ok || check.reason === 'empty') {
    return null
  }
  const groups = check.groups.join(', ')
  switch (check.reason) {
    case 'mixed':
      return translate(
        'buildWeb.take.mixed',
        'Tasks of different products or releases: {{groups}}',
        {
          groups
        }
      )
    case 'too-many':
      return translate('buildWeb.take.tooMany', 'At most 20 tasks at once.')
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

export type TakeToWorkFlags = { noWorktree: boolean; auto: boolean }

/** The skill call — only checked keys and fixed flags, never task text. */
export function buildWebBatchPrompt(keys: string[], flags: TakeToWorkFlags): string {
  const unique = [...new Set(keys)]
  if (unique.length === 0 || unique.length > MAX_BATCH || unique.some((k) => !KEY_RE.test(k))) {
    throw new Error('invalid task keys')
  }
  return [
    '/build-web-tasks batch',
    ...unique,
    flags.noWorktree ? '-no-worktree' : '',
    flags.auto ? '-auto' : ''
  ]
    .filter(Boolean)
    .join(' ')
}

/** Git repositories of the build-web monorepo (by folder name), or every git repository if none match. */
export function takeToWorkRepos(repos: readonly Repo[]): { repos: Repo[]; matchedRepo: boolean } {
  const gitRepos = repos.filter((repo) => isGitRepoKind(repo))
  const ours = gitRepos.filter((repo) =>
    /sa-dc-ap-products/i.test(`${repo.path} ${repo.displayName}`)
  )
  return ours.length ? { repos: ours, matchedRepo: true } : { repos: gitRepos, matchedRepo: false }
}

/** Live git worktrees of the build-web repository (by folder name), or every live one if none match. */
export function takeToWorkCandidates(
  repos: readonly Repo[],
  worktreesByRepo: Record<string, Worktree[] | undefined>
): { worktrees: Worktree[]; matchedRepo: boolean } {
  const pick = (list: readonly Repo[]) =>
    list.flatMap((repo) => (worktreesByRepo[repo.id] ?? []).filter((w) => !w.isArchived))
  const own = takeToWorkRepos(repos)
  const matched = own.matchedRepo ? pick(own.repos) : []
  return matched.length
    ? { worktrees: matched, matchedRepo: true }
    : { worktrees: pick(repos.filter((repo) => isGitRepoKind(repo))), matchedRepo: false }
}

/** A name for the batch's own worktree: its keys, lower-cased, at most three of them. */
export function batchWorktreeName(keys: string[]): string {
  const named = keys.slice(0, 3).map((k) => k.toLowerCase().replace(/\./g, '-'))
  return keys.length > 3 ? `${named.join('-')}-batch` : named.join('-')
}

/** The active worktree when it is a candidate, else the last one used, else the first. */
export function defaultTakeToWorkWorktree(
  candidates: Worktree[],
  activeWorktreeId: string | null,
  lastUsedId: string | null
): string | null {
  const ids = new Set(candidates.map((w) => w.id))
  if (activeWorktreeId && ids.has(activeWorktreeId)) {
    return activeWorktreeId
  }
  if (lastUsedId && ids.has(lastUsedId)) {
    return lastUsedId
  }
  return candidates[0]?.id ?? null
}
