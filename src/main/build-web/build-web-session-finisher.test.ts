import { describe, expect, it, vi } from 'vitest'
import type {
  BuildWebAgentSessionStatus,
  WorktreeBuildWebSession
} from '../../shared/build-web-session-types'
import type { WorktreeMeta } from '../../shared/worktree/meta-types'
import type { Store } from '../persistence'
import type { BuildWebWorktreeActivity } from './build-web-session-activity'
import {
  BuildWebSessionFinisher,
  type BuildWebFinisherTarget,
  type BuildWebSessionFinisherRuntime
} from './build-web-session-finisher'

// The «stuck» alarm counts this host's own waiting, so a passing failure or a restart is no alarm,
// and a wait's attention goes once a look gets past waiting.

const mocks = vi.hoisted(() => ({
  activity: vi.fn<() => Promise<BuildWebWorktreeActivity>>(),
  fetchOk: { value: true }
}))

vi.mock('./build-web-session-activity', () => ({
  readBuildWebWorktreeActivity: () => mocks.activity()
}))

vi.mock('./build-web-worktree-git-probe', () => ({
  createBuildWebWorktreeGitProbe: () => ({
    isPinned: false,
    branch: 'is-147',
    readHead: async () => ({ ref: 'refs/heads/is-147', sha: 'abc' }),
    resolveBase: async () => ({ ref: 'refs/remotes/origin/master' }),
    refreshBase: async () => mocks.fetchOk.value,
    countCommits: async () => 0,
    scanBlockers: async () => [],
    readIgnored: async () => []
  })
}))

const DAY = 24 * 60 * 60_000
const TASK = {
  issueId: 'i1',
  key: 'IS-147',
  consoleHost: 'https://bw.test',
  branch: 'is-147',
  sessionId: 's1'
}

function harness() {
  let clock = 100 * DAY
  const meta: Pick<WorktreeMeta, 'isPinned' | 'lastActivityAt' | 'buildWebTask'> & {
    buildWebSession?: WorktreeBuildWebSession
  } = { buildWebTask: TASK, isPinned: false, lastActivityAt: 1 }
  const updateManagedWorktreeMeta = vi.fn(
    async (_selector: string, updates: { buildWebSession?: WorktreeBuildWebSession | null }) => {
      meta.buildWebSession = updates.buildWebSession ?? undefined
    }
  )
  const finisher = new BuildWebSessionFinisher({
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: meta is read through getWorktreeMetaForHost only; Git is mocked.
    store: { getWorktreeMetaForHost: () => meta } as unknown as Store,
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: an ineligible session never reaches the delete queue.
    runtime: { updateManagedWorktreeMeta } as unknown as BuildWebSessionFinisherRuntime,
    reports: { hold: vi.fn(), release: vi.fn(), enqueue: vi.fn() },
    confirmEligible: async () => false,
    announceRemoved: vi.fn(),
    stuckMs: DAY,
    now: () => clock
  })
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: repo and meta of the target reach only the mocked Git probe.
  const target = {
    worktreeId: 'repo::/wt',
    path: '/wt',
    branch: 'is-147',
    task: TASK
  } as BuildWebFinisherTarget
  // The task closed long before this host first looked: the console's clock must not count.
  const closedAt = new Date(clock - 30 * DAY).toISOString()
  const status: BuildWebAgentSessionStatus = {
    id: 's1',
    issue_id: 'i1',
    issue_key: 'IS-147',
    by: 'me',
    surface_id: 'tab-1',
    surface_kind: 'terminal',
    agent: 'claude',
    execution_host_id: 'local',
    worktree_name: 'is-147',
    provider_session_id: '',
    started_at: closedAt,
    agent_finished_at: closedAt,
    ended_at: null,
    ended_state: null,
    worktree_removed_at: null,
    removal_note: null,
    state: 'closing',
    issue: null,
    closed_since: closedAt,
    eligible: true,
    finish_overdue: false
  }
  return {
    meta,
    finish: () => finisher.finish(target, status),
    advance: (ms: number) => {
      clock += ms
    }
  }
}

describe('BuildWebSessionFinisher', () => {
  it('counts a stuck wait from the first wait this host saw, not from the task closing', async () => {
    const h = harness()
    mocks.activity.mockResolvedValue({ kind: 'busy', reason: 'agent-running' })
    await h.finish()
    expect(h.meta.buildWebSession).toBeUndefined()

    h.advance(DAY - 1)
    await h.finish()
    expect(h.meta.buildWebSession).toBeUndefined()

    h.advance(2)
    await h.finish()
    expect(h.meta.buildWebSession).toMatchObject({ state: 'attention', reason: 'agent-running' })
  })

  it('lifts a state-unknown attention once a look gets past waiting', async () => {
    const h = harness()
    mocks.activity.mockResolvedValue({ kind: 'idle' })
    mocks.fetchOk.value = false
    await h.finish()
    h.advance(DAY + 1)
    await h.finish()
    expect(h.meta.buildWebSession).toMatchObject({ state: 'attention', reason: 'state-unknown' })

    mocks.fetchOk.value = true
    await h.finish()
    expect(h.meta.buildWebSession).toMatchObject({ state: 'closing' })
  })
})
