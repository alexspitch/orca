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
    isPinned: boolean
  } = { buildWebTask: TASK, lastActivityAt: 10, isPinned: false }
  let turn: () => void = () => {}
  const queued = new Promise<void>((resolve) => {
    turn = resolve
  })
  // What lands while the slow scan runs: the window the last checks must still see.
  let duringScan: () => void = () => {}
  let agentAwake = false
  const reports = { hold: vi.fn(), release: vi.fn(), enqueue: vi.fn() }
  const committed = vi.fn()
  const deps: BuildWebSessionRemovalDeps = {
    queueDelete: async (_selector, run) => {
      await queued
      return run(committed)
    },
    probe: {
      readMeta: () => meta,
      activity: async () =>
        agentAwake ? { kind: 'busy', reason: 'agent-running' } : { kind: 'idle' },
      readHead: async () => HEAD,
      scanBlockers: async () => {
        duringScan()
        return []
      }
    },
    remove: vi.fn(async () => removed),
    forceDeleteBranch: vi.fn(async () => ({ deleted: true })),
    reports,
    stopped: () => false
  }
  let metaWrite: Promise<void> = Promise.resolve()
  const runtime = {
    showManagedWorktree: async () => ({ buildWebTask: meta.buildWebTask }),
    updateManagedWorktreeMeta: async (
      _selector: string,
      updates: { buildWebTask?: WorktreeBuildWebTask | null }
    ) => {
      await metaWrite
      if (updates.buildWebTask === null) {
        delete meta.buildWebTask
      }
    }
  }
  return {
    meta,
    deps,
    reports,
    committed,
    runtime,
    turn,
    onScan: (run: () => void) => {
      duringScan = run
    },
    wakeAgent: () => {
      agentAwake = true
    },
    holdMetaWrites: (until: Promise<void>) => {
      metaWrite = until
    }
  }
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
    // Why: the sidebar never showed it deleting.
    expect(h.committed).not.toHaveBeenCalled()
    expect(h.reports.enqueue).toHaveBeenCalledWith({
      kind: 'keep',
      sessionId: 's1',
      consoleHost: 'https://bw.test'
    })
    expect(h.reports.release).toHaveBeenCalledWith('s1', undefined, undefined)
  })

  it('cancels when a Keep starts during the last check, before its write lands', async () => {
    const h = harness()
    let landWrite: () => void = () => {}
    h.holdMetaWrites(new Promise((resolve) => (landWrite = resolve)))
    let kept: ReturnType<typeof keepBuildWebWorktreeSession> | null = null
    h.onScan(() => {
      kept = keepBuildWebWorktreeSession(h.runtime, TARGET.worktreeId, h.reports)
    })
    h.turn()

    expect(await removeEmptyBuildWebWorktree(h.deps, TARGET)).toEqual({
      kind: 'cancelled',
      why: 'a person is keeping the worktree'
    })
    expect(h.deps.remove).not.toHaveBeenCalled()
    landWrite()
    expect(await kept).toEqual({ ok: true, value: true })
    expect(h.meta.buildWebTask).toBeUndefined()
  })

  it('refuses a Keep once the delete has passed its last check', async () => {
    const h = harness()
    let kept: ReturnType<typeof keepBuildWebWorktreeSession> | null = null
    vi.mocked(h.deps.remove).mockImplementationOnce(async () => {
      kept = keepBuildWebWorktreeSession(h.runtime, TARGET.worktreeId, h.reports)
      return {}
    })
    h.turn()

    expect(await removeEmptyBuildWebWorktree(h.deps, TARGET)).toEqual({ kind: 'removed' })
    expect(await kept).toMatchObject({
      ok: false,
      error: 'This workspace is already being removed.'
    })
    expect(h.reports.enqueue).not.toHaveBeenCalled()
  })

  it('cancels when the worktree is pinned or an agent wakes during the slow scan', async () => {
    const pinned = harness()
    pinned.onScan(() => {
      pinned.meta.isPinned = true
    })
    pinned.turn()
    expect(await removeEmptyBuildWebWorktree(pinned.deps, TARGET)).toEqual({
      kind: 'cancelled',
      why: 'the worktree was pinned'
    })

    const woke = harness()
    woke.onScan(woke.wakeAgent)
    woke.turn()
    expect(await removeEmptyBuildWebWorktree(woke.deps, TARGET)).toEqual({
      kind: 'cancelled',
      why: 'something runs in the worktree'
    })
    expect(pinned.deps.remove).not.toHaveBeenCalled()
    expect(woke.deps.remove).not.toHaveBeenCalled()
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
    expect(h.committed).toHaveBeenCalledTimes(1)
    expect(h.deps.forceDeleteBranch).toHaveBeenCalledWith('id:repo::/wt', 'is-147', 'abc')
    expect(h.reports.hold).toHaveBeenCalledWith('s1')
    expect(h.reports.release).toHaveBeenCalledWith('s1', undefined, undefined)
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
    expect(refused.reports.release).toHaveBeenCalledWith('s1', 'branch kept: is-147', undefined)
  })

  it('steps aside, with nothing to report, when the queue settles it unrun', async () => {
    const h = harness()
    h.deps.queueDelete = async () => {
      throw new Error('Worktree deletion already in progress: repo::/wt')
    }
    expect(await removeEmptyBuildWebWorktree(h.deps, TARGET)).toEqual({
      kind: 'cancelled',
      why: 'Worktree deletion already in progress: repo::/wt'
    })
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
