import type { ClaudeUsageSnapshot } from '../../../../../shared/claude-usage-types'
import type { CodexUsageSnapshot } from '../../../../../shared/codex-usage-types'
import type { MuseUsageSnapshot } from '../../../../../shared/muse-usage-types'
import type { OpenCodeUsageSnapshot } from '../../../../../shared/opencode-usage-types'
import { sumNullable, type UsageMergeOps } from './usage-snapshot-merge'

type ClaudeTokens = {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
}

function addClaudeTokens<T extends ClaudeTokens>(left: T, right: ClaudeTokens): T {
  return {
    ...left,
    inputTokens: left.inputTokens + right.inputTokens,
    outputTokens: left.outputTokens + right.outputTokens,
    cacheReadTokens: left.cacheReadTokens + right.cacheReadTokens,
    cacheWriteTokens: left.cacheWriteTokens + right.cacheWriteTokens
  }
}

/** Codex, OpenCode and Muse count the same five token columns. */
type TokenTotals = {
  inputTokens: number
  cachedInputTokens: number
  outputTokens: number
  reasoningOutputTokens: number
  totalTokens: number
}

function addTokenTotals<T extends TokenTotals>(left: T, right: TokenTotals): T {
  return {
    ...left,
    inputTokens: left.inputTokens + right.inputTokens,
    cachedInputTokens: left.cachedInputTokens + right.cachedInputTokens,
    outputTokens: left.outputTokens + right.outputTokens,
    reasoningOutputTokens: left.reasoningOutputTokens + right.reasoningOutputTokens,
    totalTokens: left.totalTokens + right.totalTokens
  }
}

const NO_TOKENS: TokenTotals = {
  inputTokens: 0,
  cachedInputTokens: 0,
  outputTokens: 0,
  reasoningOutputTokens: 0,
  totalTokens: 0
}

export const CLAUDE_USAGE_MERGE_OPS: UsageMergeOps<ClaudeUsageSnapshot> = {
  empty: (scope, range, scanState) => ({
    scanState: { ...scanState, hasAnyClaudeData: false },
    summary: {
      scope,
      range,
      sessions: 0,
      turns: 0,
      zeroCacheReadTurns: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      cacheReuseRate: null,
      estimatedCostUsd: null,
      hasUnpricedModels: false,
      topModel: null,
      topProject: null,
      hasAnyClaudeData: false
    },
    daily: [],
    modelBreakdown: [],
    projectBreakdown: [],
    recentSessions: []
  }),
  addSummary: (left, right) => ({
    ...addClaudeTokens(left, right),
    sessions: left.sessions + right.sessions,
    turns: left.turns + right.turns,
    zeroCacheReadTurns: left.zeroCacheReadTurns + right.zeroCacheReadTurns,
    estimatedCostUsd: sumNullable(left.estimatedCostUsd, right.estimatedCostUsd),
    hasUnpricedModels: left.hasUnpricedModels || right.hasUnpricedModels,
    hasAnyClaudeData: left.hasAnyClaudeData || right.hasAnyClaudeData
  }),
  addDaily: addClaudeTokens,
  addBreakdown: (left, right) => ({
    ...addClaudeTokens(left, right),
    sessions: left.sessions + right.sessions,
    turns: left.turns + right.turns,
    estimatedCostUsd: sumNullable(left.estimatedCostUsd, right.estimatedCostUsd)
  }),
  weight: (row) => row.inputTokens + row.outputTokens,
  // Why: the same ratio the host derives (claude-usage-report-aggregation.ts), from the summed columns.
  finishSummary: (summary) => ({
    ...summary,
    cacheReuseRate:
      summary.inputTokens + summary.cacheReadTokens > 0
        ? summary.cacheReadTokens / (summary.inputTokens + summary.cacheReadTokens)
        : null
  }),
  mergeScanState: (states, common) => ({
    ...common,
    hasAnyClaudeData: states.some((state) => state.hasAnyClaudeData)
  })
}

export const CODEX_USAGE_MERGE_OPS: UsageMergeOps<CodexUsageSnapshot> = {
  empty: (scope, range, scanState) => ({
    scanState: { ...scanState, hasAnyCodexData: false },
    summary: {
      ...NO_TOKENS,
      scope,
      range,
      sessions: 0,
      events: 0,
      estimatedCostUsd: null,
      hasUnpricedModels: false,
      topModel: null,
      topProject: null,
      hasAnyCodexData: false
    },
    daily: [],
    modelBreakdown: [],
    projectBreakdown: [],
    recentSessions: []
  }),
  addSummary: (left, right) => ({
    ...addTokenTotals(left, right),
    sessions: left.sessions + right.sessions,
    events: left.events + right.events,
    estimatedCostUsd: sumNullable(left.estimatedCostUsd, right.estimatedCostUsd),
    hasUnpricedModels: left.hasUnpricedModels || right.hasUnpricedModels,
    hasAnyCodexData: left.hasAnyCodexData || right.hasAnyCodexData
  }),
  addDaily: addTokenTotals,
  addBreakdown: (left, right) => ({
    ...addTokenTotals(left, right),
    sessions: left.sessions + right.sessions,
    events: left.events + right.events,
    estimatedCostUsd: sumNullable(left.estimatedCostUsd, right.estimatedCostUsd),
    hasInferredPricing: left.hasInferredPricing || right.hasInferredPricing
  }),
  weight: (row) => row.totalTokens,
  finishSummary: (summary) => summary,
  mergeScanState: (states, common) => ({
    ...common,
    hasAnyCodexData: states.some((state) => state.hasAnyCodexData)
  })
}

export const OPENCODE_USAGE_MERGE_OPS: UsageMergeOps<OpenCodeUsageSnapshot> = {
  empty: (scope, range, scanState) => ({
    scanState: { ...scanState, hasAnyOpenCodeData: false },
    summary: {
      ...NO_TOKENS,
      scope,
      range,
      sessions: 0,
      events: 0,
      estimatedCostUsd: null,
      topModel: null,
      topProject: null,
      hasAnyOpenCodeData: false
    },
    daily: [],
    modelBreakdown: [],
    projectBreakdown: [],
    recentSessions: []
  }),
  addSummary: (left, right) => ({
    ...addTokenTotals(left, right),
    sessions: left.sessions + right.sessions,
    events: left.events + right.events,
    estimatedCostUsd: sumNullable(left.estimatedCostUsd, right.estimatedCostUsd),
    hasAnyOpenCodeData: left.hasAnyOpenCodeData || right.hasAnyOpenCodeData
  }),
  addDaily: addTokenTotals,
  addBreakdown: (left, right) => ({
    ...addTokenTotals(left, right),
    sessions: left.sessions + right.sessions,
    events: left.events + right.events,
    estimatedCostUsd: sumNullable(left.estimatedCostUsd, right.estimatedCostUsd)
  }),
  weight: (row) => row.totalTokens,
  finishSummary: (summary) => summary,
  mergeScanState: (states, common) => ({
    ...common,
    hasAnyOpenCodeData: states.some((state) => state.hasAnyOpenCodeData)
  })
}

export const MUSE_USAGE_MERGE_OPS: UsageMergeOps<MuseUsageSnapshot> = {
  empty: (scope, range, scanState) => ({
    scanState: { ...scanState, hasAnyMuseData: false },
    summary: {
      ...NO_TOKENS,
      scope,
      range,
      sessions: 0,
      events: 0,
      topModel: null,
      topProject: null,
      hasAnyMuseData: false
    },
    daily: [],
    modelBreakdown: [],
    projectBreakdown: [],
    recentSessions: []
  }),
  addSummary: (left, right) => ({
    ...addTokenTotals(left, right),
    sessions: left.sessions + right.sessions,
    events: left.events + right.events,
    hasAnyMuseData: left.hasAnyMuseData || right.hasAnyMuseData
  }),
  addDaily: addTokenTotals,
  addBreakdown: (left, right) => ({
    ...addTokenTotals(left, right),
    sessions: left.sessions + right.sessions,
    events: left.events + right.events
  }),
  weight: (row) => row.totalTokens,
  finishSummary: (summary) => summary,
  mergeScanState: (states, common) => ({
    ...common,
    hasAnyMuseData: states.some((state) => state.hasAnyMuseData)
  })
}
