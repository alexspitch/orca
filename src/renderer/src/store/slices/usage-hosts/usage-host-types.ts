/** A paired server whose usage can be shown, under the label the status bar uses. */
export type UsageServer = { id: string; label: string }

/** Whose transcripts the usage panes read: this machine, one paired server, or all of them. */
export type UsageSource =
  | { kind: 'local' }
  | { kind: 'all' }
  // Why the label: a chosen server that drops off the connected list still has a name to show.
  | { kind: 'server'; environmentId: string; label: string }

export const LOCAL_USAGE_SOURCE: UsageSource = { kind: 'local' }

export function isSameUsageSource(left: UsageSource, right: UsageSource): boolean {
  return left.kind === 'server' && right.kind === 'server'
    ? left.environmentId === right.environmentId
    : left.kind === right.kind
}

export function usageServersKey(servers: readonly UsageServer[]): string {
  return servers.map((server) => `${server.id}\t${server.label}`).join('\n')
}
