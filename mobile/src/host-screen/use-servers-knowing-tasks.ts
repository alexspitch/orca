import { useEffect, useMemo, useState } from 'react'
import { BUILD_WEB_WORKTREE_TASK_RUNTIME_CAPABILITY } from '../../../src/shared/build-web-capability'
import { parseExecutionHostId, type ExecutionHostId } from '../../../src/shared/execution-host'
import {
  relaysToServers,
  scopeRpcClientToExecutionHost
} from '../transport/execution-host-scoped-rpc-client'
import type { RpcClient } from '../transport/rpc-client'
import { startRuntimeStatusProbe } from '../transport/runtime-status-probe'
import { NO_SERVERS_KNOWING_TASKS } from '../worktree/phone-workspace-row-filter'
import type { Worktree } from '../worktree/workspace-list-types'
import { resolveWorktreeHostId } from '../worktree/worktree-host-context-labels'

/**
 * IS-147: the paired servers among the rows whose own status announces task sessions — the
 * desktop's `taskSessionHostKnown`. Read only while a session filter would hide rows by it.
 */
export function useServersKnowingTasks(args: {
  client: RpcClient | null
  hostCapabilities: readonly string[]
  worktrees: readonly Worktree[]
  repoHostIdByRepoId: ReadonlyMap<string, ExecutionHostId>
  enabled: boolean
}): ReadonlySet<string> {
  const { client, hostCapabilities, worktrees, repoHostIdByRepoId, enabled } = args
  const relays = client !== null && relaysToServers(client, hostCapabilities)
  // Why a joined key: a refreshed row list must not restart the reads of the same servers.
  const serverKey = useMemo(() => {
    if (!enabled || !relays) {
      return ''
    }
    const servers = new Set<string>()
    for (const worktree of worktrees) {
      const hostId = resolveWorktreeHostId(worktree, repoHostIdByRepoId)
      if (parseExecutionHostId(hostId)?.kind === 'runtime') {
        servers.add(hostId)
      }
    }
    return [...servers].sort().join('\n')
  }, [enabled, relays, worktrees, repoHostIdByRepoId])
  const [known, setKnown] = useState<{ key: string; servers: ReadonlySet<string> }>({
    key: '',
    servers: NO_SERVERS_KNOWING_TASKS
  })

  useEffect(() => {
    if (!client || !serverKey) {
      return
    }
    const stops = serverKey.split('\n').map((hostId) => {
      const parsed = parseExecutionHostId(hostId)
      return parsed
        ? startRuntimeStatusProbe(scopeRpcClientToExecutionHost(client, parsed.id), (status) => {
            if (!status?.capabilities?.includes(BUILD_WEB_WORKTREE_TASK_RUNTIME_CAPABILITY)) {
              return
            }
            setKnown((current) => {
              const servers = current.key === serverKey ? current.servers : NO_SERVERS_KNOWING_TASKS
              return servers.has(hostId)
                ? current
                : { key: serverKey, servers: new Set([...servers, hostId]) }
            })
          })
        : () => {}
    })
    return () => stops.forEach((stop) => stop())
  }, [client, serverKey])

  return known.key === serverKey ? known.servers : NO_SERVERS_KNOWING_TASKS
}
