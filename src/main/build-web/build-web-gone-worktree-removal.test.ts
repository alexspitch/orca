import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { WorktreeBuildWebTask } from '../../shared/build-web-session-types'
import type { RemoveWorktreeResult } from '../../shared/worktree/create-types'
import {
  removeGoneBuildWebWorktree,
  type BuildWebGoneRemovalDeps,
  type BuildWebGoneWorktree
} from './build-web-gone-worktree-removal'
import { createBuildWebSessionReportQueue } from './build-web-session-report-queue'
import { reportRemovedBuildWebWorktree } from './build-web-session-reports'

// A folder deleted by hand: the host drops Git's record and Orca's row through the usual delete,
// keeps a branch that holds work, and the console hears of it once, as a removal outside Orca.

const HOST = 'https://bw.test'
const TASK: WorktreeBuildWebTask = {
  issueId: 'i1',
  key: 'IS-147',
  consoleHost: HOST,
  branch: 'is-147',
  sessionId: 's1'
}
const TARGET: BuildWebGoneWorktree = {
  worktreeId: 'repo::/wt',
  sessionId: 's1',
  consoleHost: HOST,
  branch: 'is-147'
}

function harness(removed: RemoveWorktreeResult = {}) {
  const reports = createBuildWebSessionReportQueue({
    filePath: join(mkdtempSync(join(tmpdir(), 'orca-bw-gone-')), 'reports.json'),
    consoleHost: () => null,
    send: async () => ({})
  })
  const meta: { buildWebTask?: WorktreeBuildWebTask } = { buildWebTask: TASK }
  let gone = true
  const deps: BuildWebGoneRemovalDeps = {
    queueDelete: async (_selector, run) => run(() => {}),
    // The delete drops the row, whose hook reports the removal while the cleanup holds it.
    remove: vi.fn(async () => {
      reportRemovedBuildWebWorktree(reports, TARGET.worktreeId, meta, () => false)
      delete meta.buildWebTask
      return removed
    }),
    forceDeleteBranch: vi.fn(async () => ({ deleted: true })),
    stopped: () => false,
    reports,
    readMeta: () => meta,
    isGone: async () => gone,
    git: {
      readTaskBranch: vi.fn(async () => 'abc'),
      taskBranchAddsNothing: vi.fn(async () => true),
      deleteTaskBranch: vi.fn(async () => {})
    }
  }
  return {
    deps,
    reports,
    folderBack: () => {
      gone = false
    }
  }
}

describe('removeGoneBuildWebWorktree', () => {
  it('drops what is left and its branch with no commits, reported once as outside Orca', async () => {
    const h = harness({ preservedBranch: { branchName: 'is-147', head: 'abc' } })
    expect(await removeGoneBuildWebWorktree(h.deps, TARGET)).toEqual({
      kind: 'removed',
      note: 'folder deleted outside Orca'
    })
    // Why the runtime's path: Git's `-d` kept it, and the runtime offers it until deleted.
    expect(h.deps.forceDeleteBranch).toHaveBeenCalledWith('id:repo::/wt', 'is-147', 'abc')
    expect(h.reports.pending()).toEqual([
      {
        kind: 'worktree-removed',
        sessionId: 's1',
        consoleHost: HOST,
        note: 'folder deleted outside Orca',
        external: true
      }
    ])
  })

  it('deletes the branch itself when Git had already forgotten the worktree', async () => {
    const h = harness()
    await removeGoneBuildWebWorktree(h.deps, TARGET)
    expect(h.deps.git.deleteTaskBranch).toHaveBeenCalledWith('abc')
    expect(h.deps.forceDeleteBranch).not.toHaveBeenCalled()
  })

  it('keeps a branch with commits of its own and says so', async () => {
    const h = harness()
    vi.mocked(h.deps.git.taskBranchAddsNothing).mockResolvedValueOnce(false)
    expect(await removeGoneBuildWebWorktree(h.deps, TARGET)).toEqual({
      kind: 'removed',
      note: 'folder deleted outside Orca; branch kept: is-147'
    })
    expect(h.deps.git.deleteTaskBranch).not.toHaveBeenCalled()
  })

  it('steps aside when the folder is back, with nothing to report', async () => {
    const h = harness()
    h.folderBack()
    expect(await removeGoneBuildWebWorktree(h.deps, TARGET)).toEqual({
      kind: 'cancelled',
      why: 'the folder is back'
    })
    expect(h.deps.remove).not.toHaveBeenCalled()
    expect(h.reports.pending()).toEqual([])
  })

  it('still tells the console the folder is gone when the delete fails', async () => {
    const h = harness()
    vi.mocked(h.deps.remove).mockRejectedValueOnce(new Error('git worktree remove failed'))
    expect((await removeGoneBuildWebWorktree(h.deps, TARGET)).kind).toBe('failed')
    expect(h.reports.pending()).toEqual([
      {
        kind: 'worktree-removed',
        sessionId: 's1',
        consoleHost: HOST,
        note: 'folder deleted outside Orca',
        external: true
      }
    ])
  })
})
