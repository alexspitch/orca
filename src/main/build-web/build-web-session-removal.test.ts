import { describe, expect, it, vi } from 'vitest'
import type {
  WorktreeBuildWebSession,
  WorktreeBuildWebTask
} from '../../shared/build-web-session-types'
import type { RemoveWorktreeResult } from '../../shared/worktree/create-types'
import { keepBuildWebWorktreeSession } from './build-web-session-keep'
import {
  removeEmptyBuildWebWorktree,
  type BuildWebEmptyWorktree,
  type BuildWebSessionRemovalDeps
} from './build-web-session-removal'

// The finisher's delete waits its turn in the workspace queue; by then only local checks decide,
// and the branch Orca made is deleted only when it is proven to add nothing.

const HEAD = { ref: 'refs/heads/is-147', sha: 'abc' }
const TASK: WorktreeBuildWebTask = {
  issueId: 'i1',
  key: 'IS-147',
  consoleHost: 'https://bw.test',
  branch: 'is-147',
  sessionId: 's1'
}
const TARGET: BuildWebEmptyWorktree = {
  worktreeId: 'repo::/wt',
  sessionId: 's1',
  branch: 'is-147',
  head: HEAD,
  lastActivityAt: 10
}

function harness(removed: RemoveWorktreeResult = {}) {
  const meta: {
    buildWebTask?: WorktreeBuildWebTask
    buildWebSession?: WorktreeBuildWebSession
    lastActivityAt: number
  } = { buildWebTask: TASK, lastActivityAt: 10 }
  let turn: () => void = () => {}
  const queued = new Promise<void>((resolve) => {
    turn = resolve
  })
  const reports = { hold: vi.fn(), release: vi.fn(), enqueue: vi.fn() }
  const deps: BuildWebSessionRemovalDeps = {
    queueDelete: async (_selector, run) => {
      await queued
      return run()
    },
    probe: {
      readMeta: () => meta,
      activity: async () => ({ kind: 'idle' }),
      readHead: async () => HEAD,
      scanBlockers: async () => []
    },
    remove: vi.fn(async () => removed),
    forceDeleteBranch: vi.fn(async () => ({ deleted: true })),
    reports
  }
  const runtime = {
    showManagedWorktree: async () => ({ buildWebTask: meta.buildWebTask }),
    updateManagedWorktreeMeta: async (
      _selector: string,
      updates: { buildWebTask?: WorktreeBuildWebTask | null }
    ) => {
      if (updates.buildWebTask === null) {
        delete meta.buildWebTask
      }
    }
  }
  return { meta, deps, reports, runtime, turn }
}

describe('removeEmptyBuildWebWorktree', () => {
  it('cancels a queued deletion when Keep took the worktree before its turn', async () => {
    const h = harness()
    const removal = removeEmptyBuildWebWorktree(h.deps, TARGET)
    expect(await keepBuildWebWorktreeSession(h.runtime, TARGET.worktreeId, h.reports)).toEqual({
      ok: true,
      value: true
    })
    h.turn()

    expect(await removal).toEqual({
      kind: 'cancelled',
      why: 'the worktree no longer holds this session'
    })
    expect(h.deps.remove).not.toHaveBeenCalled()
    expect(h.reports.enqueue).toHaveBeenCalledWith({
      kind: 'keep',
      sessionId: 's1',
      consoleHost: 'https://bw.test'
    })
    expect(h.reports.release).toHaveBeenCalledWith('s1', undefined)
  })

  it('cancels when the worktree was used while the deletion waited', async () => {
    const h = harness()
    const removal = removeEmptyBuildWebWorktree(h.deps, TARGET)
    h.meta.lastActivityAt = 11
    h.turn()
    expect((await removal).kind).toBe('cancelled')
    expect(h.deps.remove).not.toHaveBeenCalled()
  })

  it('deletes its own branch with no commits when `git branch -d` refused it', async () => {
    const h = harness({ preservedBranch: { branchName: 'is-147', head: 'abc' } })
    h.turn()
    expect(await removeEmptyBuildWebWorktree(h.deps, TARGET)).toEqual({ kind: 'removed' })
    expect(h.deps.forceDeleteBranch).toHaveBeenCalledWith('id:repo::/wt', 'is-147', 'abc')
    expect(h.reports.hold).toHaveBeenCalledWith('s1')
    expect(h.reports.release).toHaveBeenCalledWith('s1', undefined)
  })

  it('names the branch in the report when it cannot prove or finish the delete', async () => {
    const moved = harness({ preservedBranch: { branchName: 'is-147', head: 'def' } })
    moved.turn()
    expect(await removeEmptyBuildWebWorktree(moved.deps, TARGET)).toEqual({
      kind: 'removed',
      note: 'branch kept: is-147'
    })
    expect(moved.deps.forceDeleteBranch).not.toHaveBeenCalled()

    const refused = harness({ preservedBranch: { branchName: 'is-147', head: 'abc' } })
    vi.mocked(refused.deps.forceDeleteBranch).mockRejectedValueOnce(new Error('locked'))
    refused.turn()
    expect(await removeEmptyBuildWebWorktree(refused.deps, TARGET)).toEqual({
      kind: 'removed',
      note: 'branch kept: is-147'
    })
    expect(refused.reports.release).toHaveBeenCalledWith('s1', 'branch kept: is-147')
  })

  it('reports a failed removal without retrying it', async () => {
    const h = harness()
    vi.mocked(h.deps.remove).mockRejectedValueOnce(new Error('git worktree remove failed'))
    h.turn()
    expect(await removeEmptyBuildWebWorktree(h.deps, TARGET)).toEqual({
      kind: 'failed',
      error: 'git worktree remove failed'
    })
    expect(h.deps.remove).toHaveBeenCalledTimes(1)
  })
})
