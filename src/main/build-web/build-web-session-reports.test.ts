import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { reportRemovedBuildWebWorktree } from './build-web-session-reports'

// Every way of dropping a task worktree's row ends in one report: a delete removed the folder
// first, so the console hears «removed»; Forget leaves the folder, which is a Keep.

const TASK = {
  issueId: 'i1',
  key: 'IS-147',
  consoleHost: 'https://bw.test',
  branch: 'is-147',
  sessionId: 's1'
}

describe('reportRemovedBuildWebWorktree', () => {
  it('reports a Keep while the folder stays, and a removal once it is gone', () => {
    const folder = mkdtempSync(join(tmpdir(), 'orca-bw-wt-'))
    const worktreeId = `repo::${folder}`
    const reports = { enqueue: vi.fn() }

    reportRemovedBuildWebWorktree(reports, worktreeId, { buildWebTask: TASK })
    rmSync(folder, { recursive: true })
    reportRemovedBuildWebWorktree(reports, worktreeId, { buildWebTask: TASK })

    const session = { sessionId: 's1', consoleHost: 'https://bw.test' }
    expect(reports.enqueue.mock.calls).toEqual([
      [{ kind: 'keep', ...session }],
      [{ kind: 'worktree-removed', ...session }]
    ])
  })
})
