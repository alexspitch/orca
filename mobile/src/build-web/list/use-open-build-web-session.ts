import { useCallback, useState } from 'react'
import type { BuildWebAgentSession, BuildWebIssueRow } from '../../../../src/shared/build-web-types'
import {
  findSessionWorktree,
  findTaskSessionWorktree
} from '../../../../src/shared/build-web-task-session-worktree'
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

// The desktop opens the tab this client holds. A phone holds none, so it looks the session's
// workspace up on the host — by the task's link (IS-147), else by name and server — and opens its
// session screen.

type SessionIssue = Pick<BuildWebIssueRow, 'id' | 'agent_session' | 'agent_session_state'>

const hostOf = (worktree: Worktree): string => worktree.hostId ?? 'local'

function namedLike(session: BuildWebAgentSession, worktree: Worktree): boolean {
  if (worktree.displayName !== session.worktree_name) {
    return false
  }
  return !session.execution_host_id || session.execution_host_id === hostOf(worktree)
}

/**
 * The workspace among `rows`: for «Take to work», the one holding the task's open session; for the
 * session chip, the session's own by its link, or by its name when it started before links.
 */
function pick(
  rows: readonly Worktree[],
  issue: SessionIssue,
  consoleHost: string,
  forChip: boolean
): Worktree | null {
  const session = issue.agent_session
  if (!forChip) {
    return findTaskSessionWorktree(issue, rows, consoleHost)
  }
  if (!session) {
    return null
  }
  return (
    findSessionWorktree(session, issue.id, rows, consoleHost) ??
    rows.find((row) => !row.buildWebTask && namedLike(session, row)) ??
    null
  )
}

export function useOpenBuildWebSession() {
  const { client, hostId, hostCapabilities, status, notify } = useBuildWebScreen()
  const router = useRouteHandoff()
  const [opening, setOpening] = useState(false)
  const consoleHost = status.baseUrl ?? ''

  const findWorktree = useCallback(
    async (issue: SessionIssue, forChip: boolean): Promise<Worktree | null> => {
      const catalog = new WorktreeCatalogSnapshotClient()
      const fetched = await catalog.fetch(client, hostId)
      const rows = fetched.kind === 'response' ? (catalog.admit(fetched.pending) ?? []) : []
      const found = pick(rows, issue, consoleHost, forChip)
      if (found || !relaysToServers(client, hostCapabilities)) {
        return found
      }
      const servers = await fetchServerWorkspaces(client)
      return servers
        ? pick(
            applyServerWorkspaces(NO_SERVER_WORKSPACES, servers).worktrees,
            issue,
            consoleHost,
            forChip
          )
        : null
    },
    [client, consoleHost, hostCapabilities, hostId]
  )

  /** False when the phone cannot route to the workspace's server; said in a notice. */
  const openWorktree = useCallback(
    (worktree: Worktree): boolean => {
      const routeHost = workspaceRouteExecutionHost(client, hostCapabilities, worktree.hostId)
      if (routeHost === null) {
        notify('This workspace runs on a server this phone cannot reach.', 'error')
        return false
      }
      const name = encodeURIComponent(worktree.displayName || worktree.repo)
      const host = routeHost ? `&executionHost=${encodeURIComponent(routeHost)}` : ''
      router.push(
        `/h/${encodeURIComponent(hostId)}/session/${encodeURIComponent(worktree.worktreeId)}?name=${name}${host}`
      )
      return true
    },
    [client, hostCapabilities, hostId, notify, router]
  )

  /** The task's current session, from its chip: a miss is said in a notice. */
  const open = useCallback(
    async (issue: SessionIssue) => {
      const session = issue.agent_session
      if (!session) {
        return
      }
      setOpening(true)
      try {
        const worktree = await findWorktree(issue, true)
        if (!worktree) {
          notify(`No workspace “${session.worktree_name}” on this host.`, 'error')
          return
        }
        openWorktree(worktree)
      } catch (failure) {
        notify(buildWebErrorMessage(failure), 'error')
      } finally {
        setOpening(false)
      }
    },
    [findWorktree, notify, openWorktree]
  )

  /** «Take to work» again: the worktree made for the task while its session is open; false if none. */
  const openTaskWorktree = useCallback(
    async (issue: SessionIssue): Promise<boolean> => {
      const worktree = await findWorktree(issue, false).catch(() => null)
      return worktree ? openWorktree(worktree) : false
    },
    [findWorktree, openWorktree]
  )

  return { open, openTaskWorktree, openWorktree, opening }
}
