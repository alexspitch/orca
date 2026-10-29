import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toWebTerminalSurfaceTabId } from '../../../../shared/terminal-surface-id'

const { launchAgentInNewTab, callBuildWeb } = vi.hoisted(() => ({
  launchAgentInNewTab: vi.fn(),
  callBuildWeb: vi.fn()
}))

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))
vi.mock('@/store', () => ({
  useAppStore: {
    getState: () => ({ settings: {}, agentStatusByPaneKey: {} }),
    subscribe: () => () => {}
  }
}))
vi.mock('@/lib/launch-agent-in-new-tab', () => ({ launchAgentInNewTab }))
vi.mock('./build-web-client', () => ({ callBuildWeb }))
vi.mock('@/lib/focus-terminal-tab-surface', () => ({ focusTerminalTabSurface: vi.fn() }))
vi.mock('@/lib/worktree-activation', () => ({ activateAndRevealWorktree: vi.fn() }))
vi.mock('@/lib/agent-session/structured-agent-session-tab-activation', () => ({
  findStructuredAgentSessionTab: vi.fn()
}))
vi.mock('@/lib/resolve-owner', () => ({ runtimeTargetForWorkspaceOwner: vi.fn() }))
vi.mock('@/runtime/runtime-client-target', () => ({
  ipcOrRuntimeTargetForHostId: () => ({ kind: 'environment', environmentId: 'dev' })
}))

import { launchBuildWebTask } from './build-web-agent-launch'

const target = { kind: 'environment', environmentId: 'dev' } as const
const worktree = {
  id: 'repo-1::/ws/sdap-1',
  path: '/ws/sdap-1',
  hostId: 'runtime:dev',
  displayName: 'SDAP-1',
  buildWebTask: { issueId: 'issue-1', key: 'SDAP-1', consoleHost: 'https://bw', branch: 'sdap-1' }
}
const issue = { id: 'issue-1', key: 'SDAP-1', title: 'Cancel button' }

describe('launchBuildWebTask', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { setTimeout, clearTimeout })
    callBuildWeb.mockReset().mockResolvedValue({ ok: true, value: 'session-1' })
  })

  it("records a paired host's terminal under the host's own tab id", async () => {
    launchAgentInNewTab.mockReturnValue({
      surface: { kind: 'host-published' },
      pasteDraftAfterLaunch: true,
      terminalCompletion: Promise.resolve({
        outcome: { status: 'created' },
        tabId: toWebTerminalSurfaceTabId('host-tab-1')
      })
    })

    await expect(
      launchBuildWebTask({
        target,
        baseUrl: 'https://bw',
        // SAFETY: the launch reads only these fields of a worktree and a task row.
        worktree: worktree as never,
        issue: issue as never,
        flags: { auto: false }
      })
    ).resolves.toBe(true)

    expect(callBuildWeb).toHaveBeenCalledWith(target, 'setAgentSession', {
      id: 'issue-1',
      session: expect.objectContaining({ surface_kind: 'terminal', surface_id: 'host-tab-1' }),
      worktreeId: worktree.id
    })
  })
})
