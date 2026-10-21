import { translate } from '@/i18n/i18n'
import { callRuntimeRpc } from '@/runtime/runtime-rpc-client'
import { hasRuntimeRpcErrorCode } from '../../../../../shared/runtime-rpc-error-code'
import type { UsageHostProvider } from '../../../../../shared/rpc-contract/usage-params'
import type { UsageServer, UsageSource } from './usage-host-types'
import {
  mergeUsageSnapshots,
  type MergeableSnapshot,
  type UsageHostPart,
  type UsageMergeOps,
  type UsageRange,
  type UsageScope
} from './usage-snapshot-merge'

// Why long: a server's first scan after tracking turns on reads its whole transcript history.
const SERVER_REFRESH_TIMEOUT_MS = 120_000
const SERVER_SNAPSHOT_TIMEOUT_MS = 15_000
const DEFAULT_RECENT_SESSION_LIMIT = 10

/** The desktop's own usage IPC for one agent, as the usage slices call it. */
export type UsageHostApi<S extends MergeableSnapshot> = {
  getScanState: () => Promise<S['scanState']>
  setEnabled: (args: { enabled: boolean }) => Promise<S['scanState']>
  refresh: (args?: { force?: boolean }) => Promise<S['scanState']>
  getSnapshot: (args: { scope: UsageScope; range: UsageRange; limit?: number }) => Promise<S>
}

type ServerSnapshot<S> = { ok: true; snapshot: S } | { ok: false; error: string }

function callServer<T>(environmentId: string, method: string, params: unknown, timeoutMs: number) {
  return callRuntimeRpc<T>({ kind: 'environment', environmentId }, method, params, {
    timeoutMs,
    reuseRecentCompatibilityFailure: true
  })
}

// Why checked: servers ship independently, so an answer of another shape reads as needing an update.
function isUsageSnapshot(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const fields = Object.entries(value)
  const field = (name: string): unknown => fields.find(([key]) => key === name)?.[1]
  return (
    typeof field('summary') === 'object' &&
    typeof field('scanState') === 'object' &&
    ['daily', 'modelBreakdown', 'projectBreakdown', 'recentSessions'].every((name) =>
      Array.isArray(field(name))
    )
  )
}

function updateRequired(server: UsageServer): string {
  return translate(
    'auto.components.stats.usageHosts.updateRequired',
    '{{value0}}: update Orca there to see its usage',
    { value0: server.label }
  )
}

function unreachable(server: UsageServer): string {
  return translate('auto.components.stats.usageHosts.unreachable', '{{value0}}: did not answer', {
    value0: server.label
  })
}

async function readServerSnapshot<S extends MergeableSnapshot>(
  server: UsageServer,
  params: { provider: UsageHostProvider; scope: UsageScope; range: UsageRange; limit: number }
): Promise<ServerSnapshot<S>> {
  try {
    const snapshot = await callServer<S | null>(
      server.id,
      'usage.snapshot',
      params,
      SERVER_SNAPSHOT_TIMEOUT_MS
    )
    return snapshot !== null && isUsageSnapshot(snapshot)
      ? { ok: true, snapshot }
      : { ok: false, error: updateRequired(server) }
  } catch (error) {
    return {
      ok: false,
      error: hasRuntimeRpcErrorCode(error, 'method_not_found')
        ? updateRequired(server)
        : unreachable(server)
    }
  }
}

/**
 * The usage API for `source`: this machine's IPC as is, or one that reads the chosen servers too and
 * adds their snapshots up. This machine's switch stays the one that turns tracking on everywhere.
 */
export function resolveUsageHostApi<S extends MergeableSnapshot>(
  provider: UsageHostProvider,
  local: UsageHostApi<S>,
  ops: UsageMergeOps<S>,
  source: UsageSource,
  servers: readonly UsageServer[]
): UsageHostApi<S> {
  if (source.kind === 'local') {
    return local
  }
  const includeLocal = source.kind === 'all'
  const targets =
    source.kind === 'all'
      ? servers
      : [
          servers.find((server) => server.id === source.environmentId) ?? {
            id: source.environmentId,
            label: source.label
          }
        ]
  return {
    getScanState: () => local.getScanState(),
    setEnabled: (args) => local.setEnabled(args),
    refresh: async (args) => {
      const [scanState] = await Promise.all([
        includeLocal ? local.refresh(args) : local.getScanState(),
        ...targets.map((server) =>
          callServer(
            server.id,
            'usage.refresh',
            { provider, force: args?.force ?? false },
            SERVER_REFRESH_TIMEOUT_MS
          ).catch(() => null)
        )
      ])
      return scanState
    },
    getSnapshot: async ({ scope, range, limit = DEFAULT_RECENT_SESSION_LIMIT }) => {
      const params = { provider, scope, range, limit }
      const [localState, localSnapshot, ...answers] = await Promise.all([
        local.getScanState(),
        includeLocal ? local.getSnapshot({ scope, range, limit }) : null,
        ...targets.map((server) => readServerSnapshot<S>(server, params))
      ])
      const parts: UsageHostPart<S>[] = [
        ...(localSnapshot ? [{ server: null, snapshot: localSnapshot }] : []),
        ...targets.flatMap((server, index) => {
          const answer = answers[index]
          return answer?.ok ? [{ server, snapshot: answer.snapshot }] : []
        })
      ]
      const errors = answers.flatMap((answer) => (answer.ok ? [] : [answer.error]))
      return mergeUsageSnapshots(parts, errors, ops, {
        scope,
        range,
        limit,
        enabled: localState.enabled
      })
    }
  }
}
