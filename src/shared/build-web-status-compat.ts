import { BUILD_WEB_ISSUE_TESTER_RUNTIME_CAPABILITY } from './build-web-capability'
import { BUILD_WEB_OPEN_STATUSES, type BuildWebStatus } from './build-web-types'

// IS-347's self-testing: an Orca server that predates it refuses the status in a list filter.

const TESTER_STATUSES: ReadonlySet<unknown> = new Set<BuildWebStatus>(['self_testing'])

export const servesTesterStatuses = (capabilities: readonly string[]): boolean =>
  capabilities.includes(BUILD_WEB_ISSUE_TESTER_RUNTIME_CAPABILITY)

/** The statuses a server knows; all of them when it serves IS-347. */
export function statusesServed<S extends BuildWebStatus>(
  statuses: readonly S[],
  servesTester: boolean
): S[] {
  return servesTester ? [...statuses] : statuses.filter((s) => !TESTER_STATUSES.has(s))
}

/**
 * A list filter an older server accepts: the statuses it predates fall out. Null when nothing is
 * left, so the caller says to update the server instead of listing every task.
 */
export function statusFilterServed<T>(
  status: readonly T[] | undefined,
  servesTester: boolean
): T[] | undefined | null {
  if (servesTester || !status?.some((s) => TESTER_STATUSES.has(s))) {
    return status ? [...status] : status
  }
  const kept = status.filter((s) => !TESTER_STATUSES.has(s))
  return kept.length ? kept : null
}

const OPEN_BEFORE_SELF_TESTING = statusesServed(BUILD_WEB_OPEN_STATUSES, false)

/** A kept «Open» filter from before self-testing: the open set, which now holds it. */
export function upgradeKeptStatuses(statuses: readonly BuildWebStatus[]): BuildWebStatus[] {
  const same =
    statuses.length === OPEN_BEFORE_SELF_TESTING.length &&
    OPEN_BEFORE_SELF_TESTING.every((s) => statuses.includes(s))
  return same ? [...BUILD_WEB_OPEN_STATUSES] : [...statuses]
}
