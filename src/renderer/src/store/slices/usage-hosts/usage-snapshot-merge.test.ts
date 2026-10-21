import { describe, expect, it } from 'vitest'
import type {
  ClaudeUsageBreakdownRow,
  ClaudeUsageSnapshot
} from '../../../../../shared/claude-usage-types'
import { CLAUDE_USAGE_MERGE_OPS } from './usage-provider-merge-ops'
import { mergeUsageSnapshots } from './usage-snapshot-merge'

const REQUEST = { scope: 'all', range: '30d', limit: 2, enabled: true } as const
const DEV = { id: 'env-dev', label: 'dev' }

function row(key: string, input: number, cost: number | null): ClaudeUsageBreakdownRow {
  return {
    key,
    label: key,
    sessions: 1,
    turns: 2,
    inputTokens: input,
    outputTokens: 10,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    estimatedCostUsd: cost
  }
}

function snapshot(overrides: {
  input: number
  cacheRead: number
  cost: number | null
  completedAt: number | null
  model: ClaudeUsageBreakdownRow
  project: ClaudeUsageBreakdownRow
  day: string
  session: string
  error?: string
}): ClaudeUsageSnapshot {
  const base = CLAUDE_USAGE_MERGE_OPS.empty('all', '30d', {
    enabled: false,
    isScanning: false,
    lastScanStartedAt: null,
    lastScanCompletedAt: overrides.completedAt,
    lastScanError: overrides.error ?? null
  })
  return {
    ...base,
    scanState: { ...base.scanState, hasAnyClaudeData: true },
    summary: {
      ...base.summary,
      sessions: 1,
      inputTokens: overrides.input,
      cacheReadTokens: overrides.cacheRead,
      estimatedCostUsd: overrides.cost,
      hasAnyClaudeData: true
    },
    daily: [
      {
        day: overrides.day,
        inputTokens: overrides.input,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0
      }
    ],
    modelBreakdown: [overrides.model],
    projectBreakdown: [overrides.project],
    recentSessions: [
      {
        sessionId: 's1',
        lastActiveAt: overrides.session,
        durationMinutes: 1,
        projectLabel: overrides.project.label,
        branch: null,
        model: null,
        turns: 1,
        inputTokens: 1,
        outputTokens: 1,
        cacheReadTokens: 0,
        cacheWriteTokens: 0
      }
    ]
  }
}

const mac = snapshot({
  input: 100,
  cacheRead: 100,
  cost: 1,
  completedAt: 2_000,
  model: row('opus', 100, 1),
  project: row('orca', 100, null),
  day: '2026-10-20',
  session: '2026-10-20T10:00:00.000Z'
})
const dev = snapshot({
  input: 300,
  cacheRead: 0,
  cost: null,
  completedAt: 1_000,
  model: row('opus', 300, 2),
  project: row('orca', 300, null),
  day: '2026-10-21',
  session: '2026-10-21T10:00:00.000Z',
  error: 'disk full'
})

describe('mergeUsageSnapshots', () => {
  it('passes one host through, under this machine’s tracking switch', () => {
    const merged = mergeUsageSnapshots(
      [{ server: DEV, snapshot: dev }],
      [],
      CLAUDE_USAGE_MERGE_OPS,
      REQUEST
    )
    expect(merged.projectBreakdown).toEqual(dev.projectBreakdown)
    expect(merged.scanState.enabled).toBe(true)
    expect(merged.scanState.lastScanError).toBe('dev: disk full')
  })

  it('adds hosts up, keeps their projects apart and rederives the summary', () => {
    const merged = mergeUsageSnapshots(
      [
        { server: null, snapshot: mac },
        { server: DEV, snapshot: dev }
      ],
      ['srv: did not answer'],
      CLAUDE_USAGE_MERGE_OPS,
      REQUEST
    )

    expect(merged.summary).toMatchObject({
      sessions: 2,
      inputTokens: 400,
      cacheReadTokens: 100,
      cacheReuseRate: 100 / 500,
      estimatedCostUsd: 1,
      topModel: 'opus',
      topProject: 'dev · orca'
    })
    expect(merged.modelBreakdown).toEqual([
      expect.objectContaining({ key: 'opus', inputTokens: 400, sessions: 2, estimatedCostUsd: 3 })
    ])
    expect(merged.projectBreakdown.map((entry) => entry.label)).toEqual(['dev · orca', 'orca'])
    expect(merged.daily.map((point) => point.day)).toEqual(['2026-10-20', '2026-10-21'])
    expect(merged.recentSessions.map((session) => session.sessionId)).toEqual(['env-dev:s1', 's1'])
    expect(merged.scanState).toMatchObject({
      lastScanCompletedAt: 1_000,
      lastScanError: 'dev: disk full • srv: did not answer',
      hasAnyClaudeData: true
    })
  })

  it('shows only the failures when no host answered', () => {
    const merged = mergeUsageSnapshots(
      [],
      ['dev: update Orca there to see its usage'],
      CLAUDE_USAGE_MERGE_OPS,
      REQUEST
    )
    expect(merged.summary.sessions).toBe(0)
    expect(merged.scanState.lastScanError).toBe('dev: update Orca there to see its usage')
  })
})
