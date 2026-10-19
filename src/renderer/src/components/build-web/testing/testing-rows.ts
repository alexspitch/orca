import { BUILD_WEB_STATUSES, type BuildWebIssueStatus } from '../../../../../shared/build-web-types'
import type {
  BuildWebWatchEntry,
  BuildWebWatchRun
} from '../../../../../shared/build-web-watch-types'
import { isSelectable, unpushedCells, type Cell } from '../issue/build/run-cells'

// The rows of the «Testing» page: what each task has left to do with its images, in what order.

export type WatchSort = 'task' | 'status' | 'changed' | 'checked' | 'work'

export type WorkKind = 'build' | 'push' | 'tag' | 'flight'

/** One chip of the work column; an image to build and one to push are different work. */
export type WorkChip = { kind: WorkKind; count: number }

export function workChips(run: BuildWebWatchRun | null): WorkChip[] {
  if (!run) {
    return []
  }
  const chips: WorkChip[] = [
    { kind: 'build', count: run.pending },
    { kind: 'push', count: run.unpushed },
    { kind: 'tag', count: run.main_tag_left },
    { kind: 'flight', count: run.in_flight }
  ]
  return chips.filter((chip) => chip.count > 0)
}

/** The rows of the run a chip stands for, read when its menu opens: the same rules the console counts by. */
export function workCells(cells: Cell[], kind: WorkKind): Cell[] {
  switch (kind) {
    case 'build':
      return cells.filter((c) => c.state === 'pending')
    case 'push':
      return unpushedCells(cells)
    case 'tag':
      return cells.filter(
        (c) => isSelectable(c) && c.status === 'SUCCESS' && c.pushed && c.mainTagSkipped
      )
    case 'flight':
      return cells.filter((c) => c.state === 'queued' || c.state === 'building')
  }
}

/** Every image still to build, publish or finish: the number the work column sorts by. */
export function workTotal(run: BuildWebWatchRun | null): number {
  return workChips(run).reduce((sum, chip) => sum + chip.count, 0)
}

export const taskKeyOf = (entry: BuildWebWatchEntry): string => entry.issue_key ?? entry.ticket

/** The console's own status of the task; null from a console that does not send it. */
export function taskStatusOf(entry: BuildWebWatchEntry): BuildWebIssueStatus | null {
  if (entry.task_status === null) {
    return null
  }
  return BUILD_WEB_STATUSES.find((s) => s === entry.task_status) ?? 'unknown'
}

// Why numeric: SDAP-400 before SDAP-3931.
const collator = new Intl.Collator(undefined, { numeric: true })
const squash = (status: string) => status.toLowerCase().replace(/[^a-z0-9]/g, '')

/**
 * The Jira status worth a chip of its own: always when the console does not send its own status,
 * otherwise only when the two disagree (`inprogress` here, TESTING_EXTERNAL in Jira).
 */
export function jiraStatusShown(entry: BuildWebWatchEntry): string | null {
  if (!entry.jira_key) {
    return null
  }
  const jira = entry.jira_status ?? entry.status
  if (!jira) {
    return null
  }
  return entry.task_status !== null && squash(entry.task_status) === squash(jira) ? null : jira
}

export type AutoKind = 'jira' | 'next' | 'console' | 'off'

/** Who publishes the images on Done; null when the console does not say. */
export function autoKindOf(entry: BuildWebWatchEntry): AutoKind | null {
  switch (entry.auto) {
    case 'jira':
      return entry.armed === false ? 'next' : 'jira'
    case 'console':
      return 'console'
    case 'none':
      return 'off'
    case null:
      return null
  }
}

function sortValue(entry: BuildWebWatchEntry, sort: WatchSort): string | number {
  switch (sort) {
    case 'task':
      return taskKeyOf(entry)
    case 'status':
      return entry.task_status ?? entry.status
    case 'changed':
      return entry.status_changed_at
    case 'checked':
      return entry.checked_at ?? ''
    case 'work':
      return workTotal(entry.run)
  }
}

/** The console's order (work first, newest move) until a column is picked; numbers as numbers. */
export function sortWatchEntries(
  entries: readonly BuildWebWatchEntry[],
  sort: WatchSort | null,
  dir: 'asc' | 'desc'
): BuildWebWatchEntry[] {
  if (!sort) {
    return [...entries]
  }
  const sign = dir === 'asc' ? 1 : -1
  return [...entries].sort((a, b) => {
    const x = sortValue(a, sort)
    const y = sortValue(b, sort)
    const order =
      typeof x === 'number' && typeof y === 'number'
        ? x - y
        : collator.compare(String(x), String(y))
    return order * sign
  })
}
