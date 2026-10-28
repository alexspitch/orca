import { useCallback, useEffect, useMemo, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { BUILD_WEB_SESSION_TRANSCRIPT_RUNTIME_CAPABILITY } from '../../../../src/shared/build-web-capability'
import type { BuildWebSessionRow } from '../../../../src/shared/build-web-session-rows'
import { parseExecutionHostId, type ExecutionHostId } from '../../../../src/shared/execution-host'
import {
  rpcClientForExecutionHost,
  scopeRpcClientToExecutionHost
} from '../../transport/execution-host-scoped-rpc-client'
import type { RpcClient } from '../../transport/rpc-client'
import { startRuntimeStatusProbe } from '../../transport/runtime-status-probe'
import type { Worktree } from '../../worktree/workspace-list-types'

// IS-147: what a task card's «Sessions» reads from the hosts — their workspaces, kept current while
// the card is in view, and each session's log from the host that ran it, as the desktop routes it.

const CHANGE_SETTLE_MS = 300

function isWorktreeChange(payload: unknown, replay: boolean): boolean {
  if (typeof payload !== 'object' || payload === null || !('type' in payload)) {
    return false
  }
  if (payload.type === 'ready') {
    return replay
  }
  if (payload.type === 'worktreesChanged') {
    return !('sortOrderOnly' in payload && payload.sortOrderOnly === true)
  }
  return payload.type === 'reposChanged'
}

/**
 * The workspaces a card's sessions join, read when the card comes into view and again whenever the
 * host says its workspaces changed — so Keep, a removal or a new session show without reopening.
 */
export function useSessionWorktrees(
  client: RpcClient,
  listWorktrees: () => Promise<Worktree[]>,
  enabled: boolean
): readonly Worktree[] {
  const [worktrees, setWorktrees] = useState<readonly Worktree[]>([])
  useFocusEffect(
    useCallback(() => {
      if (!enabled) {
        return
      }
      let live = true
      let readySeen = false
      let timer: ReturnType<typeof setTimeout> | null = null
      const read = (): void => {
        timer = null
        void listWorktrees().then(
          (rows) => live && setWorktrees(rows),
          // Why: without the host's workspaces the history still reads, only without links.
          () => {}
        )
      }
      const unsubscribe = client.subscribe('runtime.clientEvents.subscribe', null, (payload) => {
        // Why a replayed ready too: changes made while the stream was down sent no notice.
        const replay = readySeen
        if (typeof payload === 'object' && payload !== null && 'type' in payload) {
          readySeen ||= payload.type === 'ready'
        }
        if (live && timer === null && isWorktreeChange(payload, replay)) {
          timer = setTimeout(read, CHANGE_SETTLE_MS)
        }
      })
      read()
      return () => {
        live = false
        if (timer) {
          clearTimeout(timer)
        }
        unsubscribe()
      }
    }, [client, enabled, listWorktrees])
  )
  return worktrees
}

/** A paired server's host id; null for this host, SSH or nothing. */
function serverOf(hostId: string | undefined): ExecutionHostId | null {
  const host = parseExecutionHostId(hostId)
  return host?.kind === 'runtime' ? host.id : null
}

/** The server that ran the session, as the desktop routes its log; null is the connected host. */
const logServer = (row: BuildWebSessionRow<Worktree>): ExecutionHostId | null =>
  serverOf(row.worktree ? row.worktree.hostId : row.record.execution_host_id)

/** Each server's capabilities, read through the connected host while the card shows its sessions. */
function useServerCapabilities(
  client: RpcClient,
  servers: readonly ExecutionHostId[]
): ReadonlyMap<ExecutionHostId, readonly string[]> {
  const [capabilities, setCapabilities] = useState<ReadonlyMap<ExecutionHostId, readonly string[]>>(
    new Map()
  )
  // Why a key: `servers` is a fresh array each render.
  const key = [...new Set(servers)].sort().join('\n')
  useEffect(() => {
    const hosts = key ? key.split('\n').flatMap((id) => serverOf(id) ?? []) : []
    const stops = hosts.map((host) =>
      startRuntimeStatusProbe(scopeRpcClientToExecutionHost(client, host), (status) =>
        setCapabilities((known) => new Map(known).set(host, status?.capabilities ?? []))
      )
    )
    return () => stops.forEach((stop) => stop())
  }, [client, key])
  return capabilities
}

/**
 * Per session, the client that reads its log on the host that ran it: the worktree's host while
 * the worktree is here, else the server its launcher named, else the connected host (which holds
 * build-web's token, where task sessions run). Null when that host cannot hand the log out.
 */
export function useSessionLogClients(
  client: RpcClient,
  hostCapabilities: readonly string[],
  rows: readonly BuildWebSessionRow<Worktree>[]
): ReadonlyMap<string, RpcClient> {
  const routed = useMemo(
    () =>
      rows.map((row) => {
        const server = logServer(row)
        const serverClient = server
          ? rpcClientForExecutionHost(client, hostCapabilities, server)
          : null
        return { row, server: serverClient ? server : null, serverClient }
      }),
    [client, hostCapabilities, rows]
  )
  const servers = routed.flatMap(({ server }) => (server ? [server] : []))
  const serverCapabilities = useServerCapabilities(client, servers)
  const connectedReads = hostCapabilities.includes(BUILD_WEB_SESSION_TRANSCRIPT_RUNTIME_CAPABILITY)
  const clients = new Map<string, RpcClient>()
  for (const { row, server, serverClient } of routed) {
    if (server && serverClient) {
      if (
        serverCapabilities.get(server)?.includes(BUILD_WEB_SESSION_TRANSCRIPT_RUNTIME_CAPABILITY)
      ) {
        clients.set(row.record.id, serverClient)
      }
    } else if (connectedReads && !(row.worktree && logServer(row))) {
      // Why not for a worktree on a server out of reach: the connected host has no log of it.
      clients.set(row.record.id, client)
    }
  }
  return clients
}
