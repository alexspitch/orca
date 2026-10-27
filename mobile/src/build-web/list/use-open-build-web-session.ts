import { useCallback, useState } from 'react'
import type { BuildWebAgentSession } from '../../../../src/shared/build-web-types'
import { useRouteHandoff } from '../../navigation/route-handoff'
import {
  relaysToServers,
  workspaceRouteExecutionHost
} from '../../transport/execution-host-scoped-rpc-client'
import { WorktreeCatalogSnapshotClient } from '../../worktree/worktree-catalog-snapshot-client'
import type { Worktree } from '../../worktree/workspace-list-types'
import {
  applyServerWorkspaces,
  fetchServerWorkspaces,
  NO_SERVER_WORKSPACES
} from '../../worktree/server-workspaces'
import { buildWebErrorMessage } from '../build-web-operations'
import { useBuildWebScreen } from '../build-web-screen-context'

// The desktop's BuildWebSessionBadge opens the tab this client holds. A phone holds none, so it
// looks the record's workspace up on the host by name and server, and opens its session screen.

const hostOf = (worktree: Worktree): string => worktree.hostId ?? 'local'

function matches(session: BuildWebAgentSession, worktree: Worktree): boolean {
  if (worktree.displayName !== session.worktree_name) {
    return false
  }
  return !session.execution_host_id || session.execution_host_id === hostOf(worktree)
}

export function useOpenBuildWebSession() {
  const { client, hostId, hostCapabilities, notify } = useBuildWebScreen()
  const router = useRouteHandoff()
  const [opening, setOpening] = useState(false)

  const findWorktree = useCallback(
    async (session: BuildWebAgentSession): Promise<Worktree | null> => {
      const catalog = new WorktreeCatalogSnapshotClient()
      const fetched = await catalog.fetch(client, hostId)
      const rows = fetched.kind === 'response' ? (catalog.admit(fetched.pending) ?? []) : []
      const found = rows.find((row) => matches(session, row))
      if (found || !session.execution_host_id.startsWith('runtime:')) {
        return found ?? null
      }
      if (!relaysToServers(client, hostCapabilities)) {
        return null
      }
      const servers = await fetchServerWorkspaces(client)
      return servers
        ? (applyServerWorkspaces(NO_SERVER_WORKSPACES, servers).worktrees.find((row) =>
            matches(session, row)
          ) ?? null)
        : null
    },
    [client, hostCapabilities, hostId]
  )

  const open = useCallback(
    async (session: BuildWebAgentSession) => {
      setOpening(true)
      try {
        const worktree = await findWorktree(session)
        if (!worktree) {
          notify(`No workspace “${session.worktree_name}” on this host.`, 'error')
          return
        }
        const routeHost = workspaceRouteExecutionHost(client, hostCapabilities, worktree.hostId)
        if (routeHost === null) {
          notify('This workspace runs on a server this phone cannot reach.', 'error')
          return
        }
        const name = encodeURIComponent(worktree.displayName || worktree.repo)
        const host = routeHost ? `&executionHost=${encodeURIComponent(routeHost)}` : ''
        router.push(
          `/h/${encodeURIComponent(hostId)}/session/${encodeURIComponent(worktree.worktreeId)}?name=${name}${host}`
        )
      } catch (failure) {
        notify(buildWebErrorMessage(failure), 'error')
      } finally {
        setOpening(false)
      }
    },
    [client, findWorktree, hostCapabilities, hostId, notify, router]
  )

  return { open, opening }
}
