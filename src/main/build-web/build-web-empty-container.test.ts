import { describe, expect, it, vi } from 'vitest'
import type { WorkspaceCleanupBlocker } from '../../shared/workspace-cleanup'
import {
  checkBuildWebEmptyContainer,
  type BuildWebEmptyContainerProbe
} from './build-web-empty-container'

// Orca removes a closed task's worktree only when it is provably empty; every other case is
// either «ask again later» or attention for a person.

const BASE = { ref: 'refs/remotes/origin/master' }

function probe(over: Partial<BuildWebEmptyContainerProbe> = {}): BuildWebEmptyContainerProbe {
  return {
    isPinned: false,
    branch: 'is-147',
    readHead: async () => ({ ref: 'refs/heads/is-147', sha: 'abc' }),
    resolveBase: async () => BASE,
    refreshBase: async () => true,
    countCommits: async () => 0,
    scanBlockers: async () => [],
    ...over
  }
}

describe('checkBuildWebEmptyContainer', () => {
  it('removes a clean worktree on its own branch with nothing beyond the base', async () => {
    const countCommits = vi.fn(async () => 0)
    expect(await checkBuildWebEmptyContainer(probe({ countCommits }))).toEqual({
      kind: 'empty',
      head: { ref: 'refs/heads/is-147', sha: 'abc' }
    })
    expect(countCommits).toHaveBeenCalledWith(BASE.ref, 'refs/heads/is-147')
  })

  it('never touches a pinned worktree, and never flags it', async () => {
    const readHead = vi.fn()
    expect(await checkBuildWebEmptyContainer(probe({ isPinned: true, readHead }))).toEqual({
      kind: 'pinned'
    })
    expect(readHead).not.toHaveBeenCalled()
  })

  it('flags a HEAD that left the branch Orca made, detached or on another branch', async () => {
    expect(
      await checkBuildWebEmptyContainer(
        probe({ readHead: async () => ({ ref: 'refs/heads/feature', sha: 'abc' }) })
      )
    ).toEqual({ kind: 'attention', reason: 'head-moved', detail: 'feature' })
    expect(
      await checkBuildWebEmptyContainer(
        probe({ readHead: async () => ({ ref: null, sha: 'abc' }) })
      )
    ).toEqual({ kind: 'attention', reason: 'head-moved', detail: 'detached HEAD' })
  })

  it('flags a base it cannot resolve, and waits out a failed fetch', async () => {
    expect(await checkBuildWebEmptyContainer(probe({ resolveBase: async () => null }))).toEqual({
      kind: 'attention',
      reason: 'blocked',
      detail: 'unknown-base'
    })
    const countCommits = vi.fn(async () => 0)
    expect(
      await checkBuildWebEmptyContainer(probe({ refreshBase: async () => false, countCommits }))
    ).toEqual({ kind: 'wait' })
    expect(countCommits).not.toHaveBeenCalled()
  })

  it('flags a single commit the base does not have', async () => {
    expect(await checkBuildWebEmptyContainer(probe({ countCommits: async () => 1 }))).toEqual({
      kind: 'attention',
      reason: 'commits',
      detail: '1'
    })
  })

  it.each<[WorkspaceCleanupBlocker[], unknown]>([
    [['dirty-files'], { kind: 'attention', reason: 'dirty' }],
    [['unpushed-commits'], { kind: 'attention', reason: 'commits' }],
    [['unknown-base'], { kind: 'attention', reason: 'blocked', detail: 'unknown-base' }],
    [['git-status-error'], { kind: 'wait' }],
    [['pinned'], { kind: 'empty', head: { ref: 'refs/heads/is-147', sha: 'abc' } }]
  ])('reads the cleanup scan blockers %j', async (blockers, verdict) => {
    expect(
      await checkBuildWebEmptyContainer(probe({ scanBlockers: async () => blockers }))
    ).toEqual(verdict)
  })

  it('waits when the scan has no row for the worktree', async () => {
    expect(await checkBuildWebEmptyContainer(probe({ scanBlockers: async () => null }))).toEqual({
      kind: 'wait'
    })
  })
})
