import type { TerminalTab } from '../../../../shared/terminal-tab-types'
import type { WorkspacePort } from '../../../../shared/workspace-ports'
import type { AppState } from '@/store/types'
import { taskSessionStore, worktreeIdOfTask } from './worktree-list-task-sessions.fixture-data'

// IS-147: the mockup's opened compact row — IS-166 on the Orca server «dev», with Claude working,
// Codex at rest and a live port — and IS-158's two commits, so the rows read as the mockup's.

const CURRENT_ID = worktreeIdOfTask('IS-166') ?? ''
// Why: the host counts the commits it keeps; the base names where they are missing.
const UNMERGED_ID = worktreeIdOfTask('IS-158') ?? ''
const DEV_ENVIRONMENT_ID = 'env-dev'

function agentTab(id: string, title: string, launchAgent: TerminalTab['launchAgent']): TerminalTab {
  return {
    id,
    ptyId: `pty-${id}`,
    worktreeId: CURRENT_ID,
    title,
    customTitle: null,
    color: null,
    sortOrder: 0,
    createdAt: 0,
    launchAgent
  }
}

const AGENT_TABS = [
  agentTab('tab-166-claude', '\u280b Claude Code', 'claude'),
  agentTab('tab-166-codex', 'Codex', 'codex')
]

// Why a layout: a title-derived agent row is keyed by the pane its tab shows.
const AGENT_LEAF_IDS: Record<string, string> = {
  'tab-166-claude': '16600000-0000-4000-8000-000000000001',
  'tab-166-codex': '16600000-0000-4000-8000-000000000002'
}

function agentLayouts(): NonNullable<AppState['terminalLayoutsByTabId']> {
  const layouts: NonNullable<AppState['terminalLayoutsByTabId']> = {}
  for (const [tabId, leafId] of Object.entries(AGENT_LEAF_IDS)) {
    layouts[tabId] = { root: { type: 'leaf', leafId }, activeLeafId: leafId, expandedLeafId: null }
  }
  return layouts
}

const DEV_SERVER_PORT: WorkspacePort = {
  id: 'port-166-5173',
  kind: 'workspace',
  bindHost: '127.0.0.1',
  connectHost: 'localhost',
  port: 5173,
  pid: 4242,
  processName: 'vite',
  protocol: 'http',
  owner: {
    worktreeId: CURRENT_ID,
    repoId: 'sa',
    displayName: 'is-166',
    path: '/workspaces/is-166',
    confidence: 'cwd'
  }
}

/** The task sessions' store with IS-166 on «dev», running two agents and one port. */
export function compactCurrentRowStore(): Partial<AppState> {
  const base = taskSessionStore()
  const worktreesByRepo = { ...base.worktreesByRepo }
  worktreesByRepo.sa = (worktreesByRepo.sa ?? []).map((worktree) => {
    if (worktree.id === CURRENT_ID) {
      return { ...worktree, runtimeOwnerEnvironmentId: DEV_ENVIRONMENT_ID }
    }
    if (worktree.id === UNMERGED_ID && worktree.buildWebSession) {
      return {
        ...worktree,
        baseRef: 'origin/master',
        buildWebSession: { ...worktree.buildWebSession, detail: '2' }
      }
    }
    return worktree
  })
  const ptyIdsByTabId: Record<string, string[]> = { ...base.ptyIdsByTabId }
  for (const tab of AGENT_TABS) {
    ptyIdsByTabId[tab.id] = [`pty-${tab.id}`]
  }
  return {
    ...base,
    worktreesByRepo,
    tabsByWorktree: { ...base.tabsByWorktree, [CURRENT_ID]: AGENT_TABS },
    ptyIdsByTabId,
    terminalLayoutsByTabId: { ...base.terminalLayoutsByTabId, ...agentLayouts() },
    runtimeEnvironments: [
      {
        id: DEV_ENVIRONMENT_ID,
        name: 'dev',
        createdAt: 0,
        updatedAt: 0,
        lastUsedAt: null,
        runtimeId: null,
        preferredEndpointId: 'endpoint-dev',
        endpoints: []
      }
    ],
    workspacePortScan: {
      key: 'local',
      result: { platform: 'linux', scannedAt: 0, ports: [DEV_SERVER_PORT] }
    }
  }
}
