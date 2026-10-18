import { afterEach, describe, expect, it } from 'vitest'
import type { GitRefsResult } from '../../../../shared/git-log-page-types'
import {
  cacheGitLog,
  clearGitLogCacheForTests,
  getCachedGitLog,
  gitLogFingerprint
} from './git-log-cache'
import type { GitLogRows } from './use-git-log-data'

const A = 'a'.repeat(40)
const B = 'b'.repeat(40)

function refs(...entries: [string, string][]): GitRefsResult {
  return {
    refs: entries.map(([fullName, oid]) => ({
      fullName,
      shortName: fullName.replace(/^refs\/(heads|remotes|tags)\//, ''),
      kind: 'local' as const,
      oid,
      isHead: false
    }))
  }
}

const rows = (count: number): GitLogRows => ({
  items: [],
  hasMore: count > 0,
  capped: false,
  headOnly: null,
  nextSkip: count
})

afterEach(() => clearGitLogCacheForTests())

describe('gitLogFingerprint', () => {
  it('stays the same while nothing moved', () => {
    const before = gitLogFingerprint(refs(['refs/heads/main', A]), `${A}|main`)
    expect(gitLogFingerprint(refs(['refs/heads/main', A]), `${A}|main`)).toBe(before)
  })

  it('changes on a new commit, a new or deleted branch, and a checkout', () => {
    const base = gitLogFingerprint(refs(['refs/heads/main', A]), `${A}|main`)
    expect(gitLogFingerprint(refs(['refs/heads/main', B]), `${A}|main`)).not.toBe(base)
    expect(
      gitLogFingerprint(refs(['refs/heads/main', A], ['refs/heads/x', A]), `${A}|main`)
    ).not.toBe(base)
    expect(gitLogFingerprint(refs(), `${A}|main`)).not.toBe(base)
    expect(gitLogFingerprint(refs(['refs/heads/main', A]), `${A}|x`)).not.toBe(base)
  })

  it('follows HEAD alone when the host lists no refs', () => {
    expect(gitLogFingerprint(null, `${A}|main`)).not.toBe(gitLogFingerprint(null, `${B}|main`))
  })
})

describe('log cache', () => {
  it('keeps the most recently used queries and drops the oldest', () => {
    for (let index = 0; index < 13; index += 1) {
      cacheGitLog(`q${index}`, { fingerprint: 'f', rows: rows(index) })
    }
    expect(getCachedGitLog('q0')).toBeUndefined()
    expect(getCachedGitLog('q12')?.rows.nextSkip).toBe(12)
  })

  it('refreshes recency when a query is stored again', () => {
    for (let index = 0; index < 12; index += 1) {
      cacheGitLog(`q${index}`, { fingerprint: 'f', rows: rows(index) })
    }
    cacheGitLog('q0', { fingerprint: 'f', rows: rows(99) })
    cacheGitLog('q12', { fingerprint: 'f', rows: rows(12) })
    expect(getCachedGitLog('q0')?.rows.nextSkip).toBe(99)
    expect(getCachedGitLog('q1')).toBeUndefined()
  })
})
