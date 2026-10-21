import type { BuildWebNotification } from '../../../../../shared/build-web-activity-types'

/**
 * The rows a reading brings that earlier readings did not: unread, and never seen by id. The
 * first reading of a host is the baseline — what was waiting at launch is the bell's to show.
 * A repeat folds into its row's count under the same id, so it is never announced again.
 */
export function freshNotifications(
  known: ReadonlySet<string> | null,
  items: readonly BuildWebNotification[]
): { fresh: BuildWebNotification[]; known: Set<string> } {
  const next = new Set(known ?? [])
  const fresh = known ? items.filter((n) => n.unread && !known.has(n.id)) : []
  for (const n of items) {
    next.add(n.id)
  }
  return { fresh, known: next }
}
