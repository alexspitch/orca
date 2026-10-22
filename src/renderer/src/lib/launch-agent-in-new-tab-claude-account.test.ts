// Real-store coverage: a Claude account launch with a prompt keeps the account in its pane's env.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getDefaultSettings } from '../../../shared/constants'
import { adoptAgentSessionLaunchVerdict } from '@/lib/agent-session-launch-plan'
import { createTestStore, makeWorktree, seedStore } from '../store/slices/store-test-helpers'
import { createStoreCascadesMockApi } from '../store/slices/store-cascades-test-harness'

const storeBox = vi.hoisted(() => {
  const box: { store: unknown } = { store: null }
  return box
})
const hostRoute = vi.hoisted(() => ({ launch: vi.fn() }))

vi.mock('sonner', () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn(), warning: vi.fn(), message: vi.fn() }
}))

vi.mock('@/store', () => ({
  get useAppStore() {
    return storeBox.store
  }
}))

// Why: the host route would take this launch otherwise; its plan drops the account.
vi.mock('@/lib/launch-agent-new-tab-host-route', () => ({
  newTabPromptLaunchesThroughHost: () => true,
  launchNewTabPromptThroughHost: hostRoute.launch
}))

vi.mock('@/lib/launch-agent-tab-prompt-paste', () => ({
  pasteAgentLaunchPromptOnceReady: () =>
    Promise.resolve({ delivered: true, failureNotified: false })
}))

createStoreCascadesMockApi()

const WORKTREE_ID = 'repo1::/path/wt1'

describe('launchAgentInNewTab with a Claude account', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const store = createTestStore()
    storeBox.store = store
    seedStore(store, {
      settings: getDefaultSettings('/tmp'),
      worktreesByRepo: {
        repo1: [makeWorktree({ id: WORKTREE_ID, repoId: 'repo1', path: '/path/wt1' })]
      },
      activeWorktreeId: WORKTREE_ID
    })
  })

  it('starts a prompted launch in its own pane, whose env names the account', async () => {
    const { launchAgentInNewTab } = await import('./launch-agent-in-new-tab')

    const result = launchAgentInNewTab({
      agentSessionLaunchPlan: adoptAgentSessionLaunchVerdict({
        route: 'terminal-tui',
        requestId: 'request-1',
        agent: 'claude',
        worktreeId: WORKTREE_ID
      }),
      agent: 'claude',
      worktreeId: WORKTREE_ID,
      prompt: '/build-web-tasks KEY-1',
      promptDelivery: 'submit-after-ready',
      claudeAccountId: 'acc-1'
    })

    expect(hostRoute.launch).not.toHaveBeenCalled()
    expect(result?.surface.kind).toBe('local-terminal')
    expect(result?.startupPlan.env).toMatchObject({ ORCA_CLAUDE_LAUNCH_ACCOUNT: 'acc-1' })
  })

  it('still sends a prompted launch without an account through the host', async () => {
    hostRoute.launch.mockReturnValue({
      tabId: 'tab-host',
      promptDeliveryResult: Promise.resolve({ delivered: true, failureNotified: false })
    })
    const { launchAgentInNewTab } = await import('./launch-agent-in-new-tab')

    launchAgentInNewTab({
      agentSessionLaunchPlan: adoptAgentSessionLaunchVerdict({
        route: 'terminal-tui',
        requestId: 'request-2',
        agent: 'claude',
        worktreeId: WORKTREE_ID
      }),
      agent: 'claude',
      worktreeId: WORKTREE_ID,
      prompt: '/build-web-tasks KEY-1',
      promptDelivery: 'submit-after-ready'
    })

    expect(hostRoute.launch).toHaveBeenCalledOnce()
  })
})
