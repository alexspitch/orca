// Client OSC ownership once kept its own byte-derived entry, which never carries subagents, so a paired pane showed its agent without the children only host hooks know.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeMobileSessionTabsResult } from '../../../shared/runtime-types'
import type { AgentSubagentSnapshot } from '../../../shared/agent-status-types'
import { makePaneKey } from '../../../shared/stable-pane-id'
import { toWebTerminalSurfaceTabId } from '../../../shared/terminal-surface-id'
import { getDefaultSettings } from '../../../shared/constants'
import type { AppState } from '../store/types'
import { createTestStore, makeWorktree, seedStore } from '../store/slices/store-test-helpers'
import {
  markRendererOwnedAgentStatusWrite,
  registerRendererOwnedAgentStatusPane,
  resetRendererOwnedAgentStatusPanesForTests
} from '../components/terminal-pane/renderer-owned-agent-status-registry'
import { applyFreshWebSessionTabsSnapshot } from './web-session-tabs-sync/snapshot-api'
import { resetWebSessionTabsSnapshotFreshnessForTests } from './web-session-tabs-sync/tracking-lifecycle'
import { buildWorktreeAgentRows } from '../components/sidebar/worktree-agent-rows'
import {
  selectLiveAgentStatusEntriesForWorktree,
  selectRetainedAgentEntriesForWorktree
} from '../components/sidebar/worktree-agent-row-selectors'
import {
  selectLivePtyIdsForWorktree,
  selectRuntimePaneTitlesForWorktree
} from '../components/sidebar/worktree-card-status-inputs'

vi.mock('../store', () => ({
  useAppStore: {
    setState: vi.fn(),
    getState: vi.fn(() => ({})),
    subscribe: vi.fn(() => () => {})
  }
}))

const WT = 'repo1::/path/wt1'
const ENV = 'remote-env-1'
const T0 = 1_700_000_000_000
const HOST_TAB_ID = 'host-tab-1'
const LEAF_ID = '11111111-1111-4111-8111-111111111111'
const MIRROR_TAB_ID = toWebTerminalSurfaceTabId(HOST_TAB_ID)
const MIRROR_PANE_KEY = makePaneKey(MIRROR_TAB_ID, LEAF_ID)

function hostSnapshot(
  snapshotVersion: number,
  hostNow: number,
  subagents: AgentSubagentSnapshot[] | undefined
): RuntimeMobileSessionTabsResult {
  return {
    worktree: WT,
    publicationEpoch: 'host-epoch-1',
    snapshotVersion,
    activeGroupId: 'host-group-1',
    activeTabId: `${HOST_TAB_ID}::${LEAF_ID}`,
    activeTabType: 'terminal',
    tabs: [
      {
        type: 'terminal',
        id: `${HOST_TAB_ID}::${LEAF_ID}`,
        title: 'Claude Code',
        parentTabId: HOST_TAB_ID,
        leafId: LEAF_ID,
        isActive: true,
        launchAgent: 'claude',
        status: 'ready',
        terminal: 'terminal-1',
        agentStatus: {
          state: 'working',
          prompt: '/plan-review plan.md',
          updatedAt: hostNow,
          stateStartedAt: T0 - 2_000,
          agentType: 'claude',
          paneKey: makePaneKey(HOST_TAB_ID, LEAF_ID),
          tabId: HOST_TAB_ID,
          worktreeId: WT,
          stateHistory: [],
          ...(subagents ? { subagents } : {})
        }
      }
    ]
  }
}

function applyHostSnapshot(
  store: ReturnType<typeof createTestStore>,
  snapshot: RuntimeMobileSessionTabsResult,
  now: number
): void {
  vi.setSystemTime(now)
  const state = store.getState()
  store.setState(applyFreshWebSessionTabsSnapshot(state, snapshot, ENV, now) as Partial<AppState>)
}

/** What pty-connection does for a remote pane: claim it, then write byte-derived status. */
function replayClientByteStatus(store: ReturnType<typeof createTestStore>, now: number): void {
  vi.setSystemTime(now)
  registerRendererOwnedAgentStatusPane(MIRROR_PANE_KEY, ENV)
  markRendererOwnedAgentStatusWrite(MIRROR_PANE_KEY)
  store
    .getState()
    .setAgentStatus(
      MIRROR_PANE_KEY,
      { state: 'working', prompt: '', agentType: 'claude' },
      'Claude Code',
      undefined,
      { tabId: MIRROR_TAB_ID, worktreeId: WT }
    )
}

function childRowIds(store: ReturnType<typeof createTestStore>, now: number): string[] {
  const state = store.getState()
  const tabs = state.tabsByWorktree[WT] ?? []
  return buildWorktreeAgentRows({
    tabs,
    entries: selectLiveAgentStatusEntriesForWorktree(state, WT),
    retained: selectRetainedAgentEntriesForWorktree(state, WT),
    runtimePaneTitlesByTabId: selectRuntimePaneTitlesForWorktree(state, WT),
    ptyIdsByTabId: selectLivePtyIdsForWorktree(state, WT),
    terminalLayoutsByTabId: Object.fromEntries(
      tabs.map((tab) => [tab.id, state.terminalLayoutsByTabId[tab.id]])
    ),
    now
  })
    .filter((row) => row.rowSource === 'subagent')
    .map((row) => row.childRow?.id ?? '')
}

const CHILDREN: AgentSubagentSnapshot[] = [
  { id: 'aplanreview01', state: 'working', startedAt: T0 - 1_500, agentType: 'general-purpose' },
  { id: 'aexplore02', state: 'working', startedAt: T0 - 1_000, agentType: 'Explore' }
]

describe('remote agent rows keep the host-published subagents', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(T0)
    resetWebSessionTabsSnapshotFreshnessForTests()
    resetRendererOwnedAgentStatusPanesForTests()
  })

  afterEach(() => {
    vi.useRealTimers()
    resetRendererOwnedAgentStatusPanesForTests()
  })

  it('lists the children of a pane this renderer owns from the byte stream', () => {
    const store = createTestStore()
    seedStore(store, {
      settings: getDefaultSettings('/tmp'),
      worktreesByRepo: { repo1: [makeWorktree({ id: WT, repoId: 'repo1', path: '/path/wt1' })] },
      activeWorktreeId: WT
    } as Partial<AppState>)
    applyHostSnapshot(store, hostSnapshot(1, T0 - 1_000, CHILDREN), T0)
    replayClientByteStatus(store, T0)
    applyHostSnapshot(store, hostSnapshot(2, T0 + 1_000, CHILDREN), T0 + 2_000)

    expect(childRowIds(store, T0 + 2_000)).toEqual(['aplanreview01', 'aexplore02'])

    // A child ending changes only the roster; the fenced entry must still take it.
    applyHostSnapshot(store, hostSnapshot(3, T0 + 3_000, CHILDREN.slice(0, 1)), T0 + 4_000)

    expect(childRowIds(store, T0 + 4_000)).toEqual(['aplanreview01'])
  })
})
