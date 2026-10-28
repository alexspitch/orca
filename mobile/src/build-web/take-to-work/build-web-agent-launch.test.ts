import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AGENT_LAUNCH_SURFACE_RUNTIME_CAPABILITY } from '../../../../src/shared/agent-launch-runtime-capability'
import type { BuildWebIssueRow } from '../../../../src/shared/build-web-types'
import { makePaneKey } from '../../../../src/shared/stable-pane-id'
import type { RpcClient } from '../../transport/rpc-client'

const LEAF = '7c1e0b6d-4f3a-4b1e-9d1c-2a7f5e8b9c10'
const OTHER_TAB = '4f3a7c1e-0b6d-4b1e-9d1c-2a7f5e8b9c10'

const launch = vi.hoisted(() => vi.fn())
vi.mock('../../session/mobile-existing-agent-launch', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../session/mobile-existing-agent-launch')>()),
  launchAgentInExistingWorkspace: launch
}))

const { launchBuildWebTask } = await import('./build-web-agent-launch')

const issue: BuildWebIssueRow = {
  id: 'i1',
  key: 'IS-1',
  product: 'sa',
  title: 'Fix the login',
  type: 'bug',
  status: 'inprogress',
  priority: 3,
  parent_id: null,
  parent_key: null,
  children: 0,
  children_open: 0,
  favorite: false,
  for_ai: true,
  assignee: '',
  version_id: null,
  version_name: null,
  jira_key: null,
  updated_at: '',
  agent_session: null,
  url: ''
}

// The launch itself is mocked; the client is only handed on.
const client: RpcClient = {
  sendRequest: vi.fn(),
  subscribe: () => () => {},
  updateTerminalSubscriptionViewport: vi.fn(),
  getState: () => 'connected',
  getReconnectAttempt: () => 0,
  getLastConnectedAt: () => 1,
  onStateChange: () => () => {},
  notifyForeground: vi.fn(),
  close: vi.fn()
}

let steps: string[]
const call = vi.fn(async (method: string, params: { session?: { surface_id: string } }) => {
  steps.push(method === 'setAgentSession' ? `record ${params.session?.surface_id}` : method)
  return { ok: true, value: 's1' }
})

function launched(tabId: (reserved: string) => string, promptDelivered: boolean) {
  launch.mockImplementation(async (args: { reservation: { pane: { tabId: string } } }) => {
    steps.push('launch')
    const tab = tabId(args.reservation.pane.tabId)
    return {
      kind: 'launched',
      promptDelivered,
      result: {
        worktreeId: 'wt1',
        outcome: { kind: 'terminal', handle: 'h', paneKey: makePaneKey(tab, LEAF) }
      }
    }
  })
}

const start = (capabilities: string[]) =>
  launchBuildWebTask({
    client,
    hostCapabilities: capabilities,
    // @ts-expect-error -- the mock answers every method the launch calls.
    call,
    baseUrl: 'https://bw.example',
    worktree: { worktreeId: 'wt1', displayName: 'Fix the login', folder: 'is-1' },
    issue,
    flags: { auto: false, ownWorktree: false, instruction: '' }
  })

describe('starting a task session from the phone', () => {
  beforeEach(() => {
    steps = []
    call.mockClear()
  })

  it('records the session in its reserved tab before the prompt, under the folder name', async () => {
    let reserved = ''
    launched((tab) => (reserved = tab), true)
    await start([AGENT_LAUNCH_SURFACE_RUNTIME_CAPABILITY])
    expect(steps).toEqual([`record ${reserved}`, 'launch'])
    expect(call.mock.calls[0]?.[1]).toMatchObject({
      worktreeId: 'wt1',
      session: { worktree_name: 'is-1', surface_kind: 'terminal' }
    })
  })

  it('abandons the recorded session when the prompt never arrived', async () => {
    let reserved = ''
    launched((tab) => (reserved = tab), false)
    await start([AGENT_LAUNCH_SURFACE_RUNTIME_CAPABILITY])
    expect(steps).toEqual([`record ${reserved}`, 'launch', 'clearAgentSession'])
    expect(call.mock.calls[1]?.[1]).toMatchObject({ surfaceId: reserved, abandon: true })
  })

  it('moves the record to the tab a host opened instead of the reserved one', async () => {
    let reserved = ''
    launched((tab) => ((reserved = tab), OTHER_TAB), true)
    await start([AGENT_LAUNCH_SURFACE_RUNTIME_CAPABILITY])
    expect(steps).toEqual([
      `record ${reserved}`,
      'launch',
      'clearAgentSession',
      `record ${OTHER_TAB}`
    ])
  })

  it('records only after delivery on a host that cannot be told the surface', async () => {
    launched(() => OTHER_TAB, true)
    await start([])
    expect(steps).toEqual(['launch', `record ${OTHER_TAB}`])
    expect(launch.mock.calls[0]?.[0]).not.toHaveProperty('surface')
  })
})
