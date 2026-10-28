import { useCallback } from 'react'
import { buildWebErrorMessage, callBuildWeb } from '../build-web/build-web-operations'
import type { RpcClient } from '../transport/rpc-client'
import { rpcClientForExecutionHost } from '../transport/execution-host-scoped-rpc-client'
import type { Worktree } from '../worktree/workspace-list-types'
import type { HostScreenState } from './use-host-screen-state'

// IS-147: «Keep» and «Back to work» for a closed task's leftover, run on the host that owns the
// worktree, as the desktop's row menu runs them.

type Outcome = { ok: true } | { ok: false; error: string }

export function useTaskAttentionActions(args: {
  client: RpcClient | null
  hostCapabilities: readonly string[]
  fetchWorktrees: () => Promise<void>
  state: Pick<HostScreenState, 'setActionError' | 'setServerNotice'>
}) {
  const { client, hostCapabilities, fetchWorktrees, state } = args
  const { setActionError, setServerNotice } = state

  const run = useCallback(
    async (item: Worktree, call: (rowClient: RpcClient) => Promise<Outcome>, done: string) => {
      const rowClient = client && rpcClientForExecutionHost(client, hostCapabilities, item.hostId)
      if (!rowClient) {
        setActionError('The host of this workspace is not reachable.')
        return
      }
      try {
        const result = await call(rowClient)
        if (!result.ok) {
          setActionError(result.error)
          return
        }
        setServerNotice(done)
        void fetchWorktrees()
      } catch (failure) {
        setActionError(buildWebErrorMessage(failure))
      }
    },
    [client, hostCapabilities, fetchWorktrees, setActionError, setServerNotice]
  )

  /** «Keep»: the host unlinks the worktree from its task; the worktree stays as it is. */
  const keepTaskSession = useCallback(
    (item: Worktree) =>
      run(
        item,
        (rowClient) =>
          callBuildWeb(rowClient, 'keepWorktreeSession', { worktreeId: item.worktreeId }),
        `${item.displayName || item.repo} kept, unlinked from ${item.buildWebTask?.key ?? 'its task'}`
      ),
    [run]
  )

  /** «Back to work»: reopens the task in the console, which takes the session out of closing. */
  const reopenTask = useCallback(
    (item: Worktree) => {
      const task = item.buildWebTask
      // Why the check: worktree.ps rows are unchecked wire data.
      if (!task || typeof task.issueId !== 'string') {
        return Promise.resolve()
      }
      return run(
        item,
        (rowClient) =>
          callBuildWeb(rowClient, 'updateIssue', {
            id: task.issueId,
            patch: { status: 'inprogress' }
          }),
        `${task.key} is back in progress`
      )
    },
    [run]
  )

  return { keepTaskSession, reopenTask }
}
