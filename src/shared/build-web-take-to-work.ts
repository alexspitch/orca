import type { BuildWebIssueRow } from './build-web-types'
import type { Repo } from './repo-types'
import { isGitRepoKind } from './repo-kind'

// «Take to work», as the desktop and the phone both decide it: one task, where it runs, and the one
// line the agent receives. Each client words the refusals itself.

export const MAX_INSTRUCTION = 4000
const KEY_RE = /^[A-Z][A-Z0-9]*-\d+(?:\.\d+)?$/

export type BatchCheck =
  | { ok: true }
  | {
      ok: false
      reason: 'empty' | 'too-many' | 'bad-key' | 'unknown-product'
      groups: string[]
    }

type BatchIssue = Pick<BuildWebIssueRow, 'key' | 'product'>

/** One task at a time (IS-147): its session, its worktree and their cleanup follow that task alone. */
export function validateBuildWebBatch(issues: readonly BatchIssue[]): BatchCheck {
  if (issues.length === 0) {
    return { ok: false, reason: 'empty', groups: [] }
  }
  if (issues.length > 1) {
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
  return { ok: true }
}

export type TakeToWorkFlags = {
  auto: boolean
  /** The skill makes its own worktree: a `cp` task, worked in chat-platform beside its clone. */
  ownWorktree?: boolean
  /** The person's own words for this run, sent after the skill call. */
  instruction?: string
}

/** A `cp` task: the session stays in the monorepo, the work goes to chat-platform. */
export const isChatPlatformBatch = (issues: readonly Pick<BuildWebIssueRow, 'product'>[]) =>
  issues.length > 0 && issues.every((issue) => issue.product === 'cp')

/**
 * The skill call — only a checked key and fixed flags, never task text. `code KEY -no-worktree`:
 * Orca made the worktree the session runs in. A `cp` task keeps its `batch KEY` call without
 * `-no-worktree`, since the skill refuses a monorepo tree for it and makes chat-platform's itself.
 * The person's instruction, if any, follows on lines of its own, named as theirs.
 */
export function takeToWorkPrompt(key: string, flags: TakeToWorkFlags): string {
  if (!KEY_RE.test(key)) {
    throw new Error('invalid task key')
  }
  const call = (
    flags.ownWorktree
      ? ['/build-web-tasks batch', key]
      : ['/build-web-tasks code', key, '-no-worktree']
  )
    .concat(flags.auto ? ['-auto'] : [])
    .join(' ')
  const instruction = flags.instruction?.trim().slice(0, MAX_INSTRUCTION)
  return instruction
    ? `${call}\n\nAdditional instruction from the person who took this task to work:\n${instruction}`
    : call
}

type TakeToWorkRepoFields = Pick<Repo, 'path' | 'displayName' | 'kind'>

/** Git repositories of the build-web monorepo (by folder name), or every git repository if none match. */
export function takeToWorkRepos<R extends TakeToWorkRepoFields>(
  repos: readonly R[]
): { repos: R[]; matchedRepo: boolean } {
  const gitRepos = repos.filter((repo) => isGitRepoKind(repo))
  const ours = gitRepos.filter((repo) =>
    /sa-dc-ap-products/i.test(`${repo.path} ${repo.displayName}`)
  )
  return ours.length ? { repos: ours, matchedRepo: true } : { repos: gitRepos, matchedRepo: false }
}

/** Live git worktrees of the build-web repository (by folder name), or every live one if none match. */
export function takeToWorkCandidates<
  R extends TakeToWorkRepoFields,
  W extends { isArchived?: boolean }
>(
  repos: readonly R[],
  worktreesOf: (repo: R) => readonly W[]
): { worktrees: W[]; matchedRepo: boolean } {
  const pick = (list: readonly R[]) =>
    list.flatMap((repo) => worktreesOf(repo).filter((w) => !w.isArchived))
  const own = takeToWorkRepos(repos)
  const matched = own.matchedRepo ? pick(own.repos) : []
  return matched.length
    ? { worktrees: matched, matchedRepo: true }
    : { worktrees: pick(repos.filter((repo) => isGitRepoKind(repo))), matchedRepo: false }
}

type NamedWorktree = { displayName?: string; branch?: string; path?: string }

const lastSegment = (value: string | undefined): string =>
  value
    ?.replace(/^refs\/heads\//, '')
    .split(/[\\/]/)
    .pop()
    ?.toLowerCase() ?? ''

/** The names a repository's worktrees already take: label, folder and branch, the latter two by their last part. */
export function takenWorktreeNames(worktrees: readonly NamedWorktree[]): Set<string> {
  return new Set(
    worktrees.flatMap((w) =>
      [w.displayName?.toLowerCase() ?? '', lastSegment(w.path), lastSegment(w.branch)].filter(
        Boolean
      )
    )
  )
}

/** The task's own worktree: its key in lower case with dots as dashes, then `-2`, `-3`… while taken. */
export function taskWorktreeName(key: string, taken: ReadonlySet<string> = new Set()): string {
  const base = key.toLowerCase().replace(/\./g, '-')
  for (let n = 1; ; n += 1) {
    const name = n === 1 ? base : `${base}-${n}`
    if (!taken.has(name)) {
      return name
    }
  }
}

/** The active worktree when it is a candidate, else the last one used, else the first. */
export function defaultTakeToWorkWorktree(
  candidateIds: readonly string[],
  activeWorktreeId: string | null,
  lastUsedId: string | null
): string | null {
  if (activeWorktreeId && candidateIds.includes(activeWorktreeId)) {
    return activeWorktreeId
  }
  if (lastUsedId && candidateIds.includes(lastUsedId)) {
    return lastUsedId
  }
  return candidateIds[0] ?? null
}
