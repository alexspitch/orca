import '../unused-default-rpc-methods.test-fixture'
import { describe, expect, it, vi } from 'vitest'
import { RpcDispatcher } from '../dispatcher'
import type { OrcaRuntimeService } from '../../orca-runtime'
import { WORKTREE_METHODS } from './worktree'

// IS-147: the branch Orca may delete and the console session are the host's; a client names neither.

const reports = vi.hoisted(() => ({ enqueue: vi.fn() }))

vi.mock('../../../build-web/build-web-session-reports', () => ({
  buildWebSessionReports: () => reports
}))

describe('worktree.set buildWebTask', () => {
  it('takes the branch and the session from the host, never from the client', async () => {
    const linked = {
      issueId: 'i1',
      key: 'IS-147',
      consoleHost: 'https://bw.test',
      branch: 'is-147',
      sessionId: 's1'
    }
    const updateManagedWorktreeMeta = vi.fn().mockResolvedValue({ id: 'wt-1' })
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: worktree.set with a task link reaches only these members.
    const runtime = {
      getRuntimeId: () => 'test-runtime',
      showManagedWorktree: vi
        .fn()
        .mockResolvedValueOnce({
          isMainWorktree: false,
          repoId: 'repo-1',
          branch: 'refs/heads/main',
          buildWebTask: linked
        })
        .mockResolvedValueOnce({
          isMainWorktree: false,
          repoId: 'repo-1',
          branch: 'refs/heads/x/y'
        }),
      showRepo: vi.fn().mockResolvedValue({ kind: 'git' }),
      updateManagedWorktreeMeta,
      getUIState: () => ({})
    } as unknown as OrcaRuntimeService
    const dispatcher = new RpcDispatcher({ runtime, methods: WORKTREE_METHODS })
    const client = { ...linked, branch: 'main', sessionId: 'forged' }
    const set = (worktree: string) =>
      dispatcher.dispatch({
        id: 'req-1',
        authToken: 'tok',
        method: 'worktree.set',
        params: { worktree, buildWebTask: client }
      })

    await set('id:wt-1')
    await set('id:wt-2')

    expect(updateManagedWorktreeMeta.mock.calls.map(([, updates]) => updates.buildWebTask)).toEqual(
      [linked, { issueId: 'i1', key: 'IS-147', consoleHost: 'https://bw.test', branch: 'x/y' }]
    )
  })

  it('drops the link the Keep way: the console hears it and the state goes with it', async () => {
    const task = {
      issueId: 'i1',
      key: 'IS-147',
      consoleHost: 'https://bw.test',
      branch: 'is-147',
      sessionId: 's1'
    }
    const updateManagedWorktreeMeta = vi.fn().mockResolvedValue({ id: 'repo-1::/wt' })
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: worktree.set dropping a task link reaches only these members.
    const runtime = {
      getRuntimeId: () => 'test-runtime',
      showManagedWorktree: vi.fn().mockResolvedValue({ id: 'repo-1::/wt', buildWebTask: task }),
      updateManagedWorktreeMeta,
      getUIState: () => ({})
    } as unknown as OrcaRuntimeService
    const dispatcher = new RpcDispatcher({ runtime, methods: WORKTREE_METHODS })

    await dispatcher.dispatch({
      id: 'req-1',
      authToken: 'tok',
      method: 'worktree.set',
      params: { worktree: 'name:wt', buildWebTask: null }
    })

    expect(reports.enqueue).toHaveBeenCalledWith({
      kind: 'keep',
      sessionId: 's1',
      consoleHost: 'https://bw.test'
    })
    expect(updateManagedWorktreeMeta).toHaveBeenCalledWith('id:repo-1::/wt', {
      buildWebTask: null,
      buildWebSession: null
    })
  })
})
