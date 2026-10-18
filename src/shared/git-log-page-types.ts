import type { GitHistoryItem, GitHistoryItemRef } from './git-history-types'

export const GIT_LOG_PAGE_DEFAULT_LIMIT = 300
export const GIT_LOG_PAGE_MAX_LIMIT = 3000
export const GIT_LOG_PAGE_MAX_REFS = 64
export const GIT_LOG_PAGE_MAX_SINCE_DAYS = 3650
/** Commits the page keeps loaded at most; past it the list asks for narrower filters. */
export const GIT_LOG_PAGE_MAX_LOADED = 20_000

/** `all` is every local and remote branch plus HEAD, as WebStorm's "Branch: All". */
export type GitLogScope = { kind: 'all' } | { kind: 'refs'; refs: string[] }

export type GitLogQuery = {
  scope?: GitLogScope
  limit?: number
  /** Commits to pass over first: the next page after the ones already shown. */
  skip?: number
  /** Matched against the message; a hex string of 4+ characters is also tried as a hash. */
  text?: string
  regex?: boolean
  matchCase?: boolean
  author?: string
  sinceDays?: number
}

export type GitLogPageResult = {
  items: GitHistoryItem[]
  currentRef?: GitHistoryItemRef
  hasMore: boolean
  limit: number
  /** The `skip` that loads the next page (a commit found by hash is not counted). */
  nextSkip: number
}

export type GitRefKind = 'local' | 'remote' | 'tag'

export type GitRefEntry = {
  /** e.g. `refs/remotes/origin/main` */
  fullName: string
  /** e.g. `origin/main` */
  shortName: string
  kind: GitRefKind
  /** The commit the ref points at (tags are peeled). */
  oid: string
  /** Full name of the tracked branch, for local branches that have one. */
  upstream?: string
  isHead: boolean
}

export type GitRefsResult = {
  refs: GitRefEntry[]
  /** `user.name` on the executing host, for the "me" author filter. */
  userName?: string
}

export type GitRefsContainingResult = {
  /** Short names; `HEAD` first when the commit is reachable from it. */
  refs: string[]
}
