/** Whose provider accounts the status bar shows; automatic follows the focused workspace's owner. */
export type StatusBarUsageHost =
  | { kind: 'auto' }
  | { kind: 'local' }
  | { kind: 'environment'; environmentId: string }

export type StatusBarUsageScope = {
  host: StatusBarUsageHost
  /** One chip per Claude and Codex account on that host, not only the active one. */
  allAccounts: boolean
}

export const DEFAULT_STATUS_BAR_USAGE_SCOPE: StatusBarUsageScope = {
  host: { kind: 'auto' },
  allAccounts: false
}

function field(value: object, name: string): unknown {
  return Object.entries(value).find(([key]) => key === name)?.[1]
}

function normalizeHost(value: unknown): StatusBarUsageHost {
  if (typeof value !== 'object' || value === null) {
    return DEFAULT_STATUS_BAR_USAGE_SCOPE.host
  }
  const kind = field(value, 'kind')
  const environmentId = field(value, 'environmentId')
  if (kind === 'local') {
    return { kind: 'local' }
  }
  return kind === 'environment' && typeof environmentId === 'string' && environmentId.trim()
    ? { kind: 'environment', environmentId }
    : DEFAULT_STATUS_BAR_USAGE_SCOPE.host
}

export function normalizeStatusBarUsageScope(value: unknown): StatusBarUsageScope {
  if (typeof value !== 'object' || value === null) {
    return DEFAULT_STATUS_BAR_USAGE_SCOPE
  }
  return {
    host: normalizeHost(field(value, 'host')),
    allAccounts: field(value, 'allAccounts') === true
  }
}
