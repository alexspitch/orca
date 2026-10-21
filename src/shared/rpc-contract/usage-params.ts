import { z } from 'zod'

// A host's token usage, read by a client that shows several hosts' usage side by side.
export const USAGE_HOST_PROVIDERS = ['claude', 'codex', 'opencode', 'muse'] as const
export type UsageHostProvider = (typeof USAGE_HOST_PROVIDERS)[number]

const Provider = z.enum(USAGE_HOST_PROVIDERS)

export const UsageSnapshotParams = z.object({
  provider: Provider,
  scope: z.enum(['orca', 'all']),
  range: z.enum(['7d', '30d', '90d', 'all']),
  limit: z.number().int().min(1).max(50).optional()
})

export const UsageRefreshParams = z.object({
  provider: Provider,
  force: z.boolean().optional()
})
