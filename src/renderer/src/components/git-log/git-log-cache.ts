import type { GitRefsResult } from '../../../../shared/git-log-page-types'
import { stableHashString } from '@/runtime/sync-runtime-graph/editor-draft-hash'
import type { GitLogUnsupportedReason } from './git-log-client'
import type { GitLogRows } from './use-git-log-data'

// Why in memory: reopening the page or going back to a filter shows its commits at once, and the
// ref list (read anyway) tells whether they are still current. A restart starts empty.

/** Logs kept: each one can hold many pages, so the oldest queries go first. */
const LOGS_KEPT = 12
const REFS_KEPT = 12

export type GitLogCachedLog = {
  /** The repository state the rows were read in; null until the ref list for it arrives. */
  fingerprint: string | null
  rows: GitLogRows
}

export type GitLogCachedRefs = {
  data: GitRefsResult | null
  unsupported: GitLogUnsupportedReason | null
}

const logs = new Map<string, GitLogCachedLog>()
const refLists = new Map<string, GitLogCachedRefs>()

function remember<T>(map: Map<string, T>, key: string, value: T, kept: number): void {
  // Re-inserted last so eviction drops the entry used longest ago.
  map.delete(key)
  map.set(key, value)
  while (map.size > kept) {
    const oldest = map.keys().next().value
    if (oldest === undefined) {
      break
    }
    map.delete(oldest)
  }
}

export function getCachedGitLog(queryKey: string): GitLogCachedLog | undefined {
  return logs.get(queryKey)
}

export function cacheGitLog(queryKey: string, entry: GitLogCachedLog): void {
  remember(logs, queryKey, entry, LOGS_KEPT)
}

export function getCachedGitRefs(contextKey: string): GitLogCachedRefs | undefined {
  return refLists.get(contextKey)
}

export function cacheGitRefs(contextKey: string, entry: GitLogCachedRefs): void {
  remember(refLists, contextKey, entry, REFS_KEPT)
}

/**
 * What the log depends on: every branch, remote branch and tag with its commit, plus the
 * worktree's HEAD and branch. A checkout, commit, fetch, rebase or deleted branch changes it.
 */
export function gitLogFingerprint(refs: GitRefsResult | null, headKey: string): string {
  if (!refs) {
    return `head-only:${headKey}`
  }
  const lines = refs.refs.map((ref) => `${ref.fullName}\0${ref.oid}`)
  return `${refs.refs.length}:${stableHashString(`${headKey}\n${lines.join('\n')}`)}`
}

export function clearGitLogCacheForTests(): void {
  logs.clear()
  refLists.clear()
}
