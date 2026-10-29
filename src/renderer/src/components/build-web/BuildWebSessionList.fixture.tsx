import { defineFixture } from '../../component-fixtures/component-fixture'
import type { BuildWebAgentSessionRecord } from '../../../../shared/build-web-session-types'
import {
  BuildWebSessionList,
  BuildWebSessionRows,
  type SessionListRow
} from './BuildWebSessionList'
import { OverviewPanel } from './issue/IssueOverviewCards'

const record = (
  id: string,
  over: Partial<BuildWebAgentSessionRecord>
): BuildWebAgentSessionRecord => ({
  id,
  issue_id: 'i1',
  issue_key: 'IS-147',
  by: 'alex.trusov@spitch.ch',
  surface_id: `tab-${id}`,
  surface_kind: 'terminal',
  agent: 'claude',
  execution_host_id: 'local',
  worktree_name: 'is-147',
  provider_session_id: `ps-${id}`,
  started_at: '2026-10-28T09:12:00Z',
  agent_finished_at: null,
  ended_at: null,
  ended_state: null,
  worktree_removed_at: null,
  removal_note: null,
  state: 'active',
  ...over
})

const rows: SessionListRow[] = [
  {
    record: record('s4', { worktree_name: 'is-147-3', state: 'waiting' }),
    worktree: { id: 'repo::/w/is-147-3', displayName: 'is-147-3' },
    attention: null
  },
  {
    record: record('s3', {
      worktree_name: 'is-147-2',
      started_at: '2026-10-27T10:05:00Z',
      ended_at: '2026-10-27T18:40:00Z',
      ended_state: 'replaced',
      state: 'replaced'
    }),
    worktree: { id: 'repo::/w/is-147-2', displayName: 'is-147-2' },
    attention: { state: 'attention', reason: 'commits', at: 1 }
  },
  {
    record: record('s2', {
      started_at: '2026-09-02T08:00:00Z',
      agent_finished_at: '2026-09-02T11:30:00Z',
      ended_at: '2026-09-02T11:41:00Z',
      ended_state: 'removed',
      worktree_removed_at: '2026-09-02T11:41:00Z',
      removal_note: 'Branch is-147 kept: it was never merged.',
      state: 'removed'
    }),
    worktree: null,
    attention: null
  },
  {
    record: record('s1', {
      started_at: '2026-09-01T08:00:00Z',
      ended_at: '2026-09-01T08:01:00Z',
      ended_state: 'abandoned',
      provider_session_id: '',
      state: 'abandoned'
    }),
    worktree: null,
    attention: null
  }
]

export const history = defineFixture({
  width: 640,
  render: () => (
    <BuildWebSessionList
      rows={rows}
      onOpen={() => {}}
      logFor={(row) => (row.record.provider_session_id ? () => {} : null)}
    />
  )
})

/** The card in the overview's side column, under Jira, at its default width. */
export const sideColumn = defineFixture({
  width: 380,
  render: () => (
    <OverviewPanel title="Sessions">
      <BuildWebSessionRows
        rows={rows}
        onOpen={() => {}}
        logFor={(row) => (row.record.provider_session_id ? () => {} : null)}
      />
    </OverviewPanel>
  )
})
