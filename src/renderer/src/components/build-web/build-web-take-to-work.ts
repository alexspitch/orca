import type { BuildWebIssueRow } from '../../../../shared/build-web-types'
import type { Repo } from '../../../../shared/repo-types'
import type { Worktree } from '../../../../shared/worktree/types'
import { isGitRepoKind } from '../../../../shared/repo-kind'
import { productLabel } from './build-web-labels'

// «Take to work»: which tasks may go together, where, and the one line the agent receives.

export const MAX_BATCH = 20
const KEY_RE = /^[A-Z][A-Z0-9]*-\d+(?:\.\d+)?$/
/** Agents that run the build-web-tasks skill; others call skills differently. */
export const BUILD_WEB_SKILL_AGENTS = ['claude'] as const

export type BatchCheck =
  | { ok: true }
  | { ok: false; reason: 'empty' | 'mixed' | 'too-many' | 'bad-key'; groups: string[] }

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

/** Git worktrees of the build-web repository (by its folder name), or every git worktree if none match. */
export function takeToWorkCandidates(
  repos: readonly Repo[],
  worktreesByRepo: Record<string, Worktree[] | undefined>
): { worktrees: Worktree[]; matchedRepo: boolean } {
  const gitRepos = repos.filter((repo) => isGitRepoKind(repo))
  const ours = gitRepos.filter((repo) =>
    /sa-dc-ap-products/i.test(`${repo.path} ${repo.displayName}`)
  )
  const pick = (list: readonly Repo[]) => list.flatMap((repo) => worktreesByRepo[repo.id] ?? [])
  const matched = pick(ours)
  return matched.length
    ? { worktrees: matched, matchedRepo: true }
    : { worktrees: pick(gitRepos), matchedRepo: false }
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
