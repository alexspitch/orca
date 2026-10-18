import { useState } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import type {
  BuildWebWatchEntry,
  BuildWebWatchRun
} from '../../../../../shared/build-web-watch-types'
import type { BuildWebCardTab } from '../build-web-store'
import { BuildWebSortHeader } from '../BuildWebSortHeader'
import { BuildWebToneChip, StatusChip } from '../BuildWebToneChip'
import { jiraStatusTone, type ChipTone } from '../build-web-tones'
import {
  autoKindOf,
  jiraStatusShown,
  sortWatchEntries,
  taskKeyOf,
  taskStatusOf,
  workChips,
  type AutoKind,
  type WatchSort,
  type WorkChip,
  type WorkKind
} from './testing-rows'

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : '—')
const openUrl = (url: string) => void window.api.shell.openUrl(url)

type Sorting = { sort: WatchSort | null; dir: 'asc' | 'desc' }

const WORK_TONE: Record<WorkKind, ChipTone | null> = {
  build: 'amber',
  push: null,
  tag: 'ochre',
  flight: 'sky'
}

function workLabel({ kind, count }: WorkChip): string {
  switch (kind) {
    case 'build':
      return translate('buildWeb.testing.toBuild', '{{count}} to build', { count })
    case 'push':
      return translate('buildWeb.testing.toPush', '{{count}} to push', { count })
    case 'tag':
      return translate('buildWeb.testing.versionTag', '{{count}} version tag', { count })
    case 'flight':
      return translate('buildWeb.testing.building', '{{count}} building', { count })
  }
}

function workHint(chip: WorkChip, run: BuildWebWatchRun, done: string): string {
  const where = `${run.branch} · ${when(run.created_at)}`
  switch (chip.kind) {
    case 'build':
      return translate(
        'buildWeb.testing.toBuildHint',
        '{{where}} — never built; built on the move to {{done}}',
        { where, done }
      )
    case 'tag':
      return translate(
        'buildWeb.testing.versionTagHint',
        '{{where}} — published under the build tag only; the version tag moves on {{done}}',
        { where, done }
      )
    case 'push':
    case 'flight':
      return where
  }
}

function autoLabel(kind: AutoKind | null, done: string): string {
  switch (kind) {
    case 'jira':
      return translate('buildWeb.testing.autoJira', 'on Jira → {{done}}', { done })
    case 'next':
      return translate('buildWeb.testing.autoNext', 'joins at the next check')
    case 'console':
      return translate('buildWeb.testing.autoConsole', 'on {{done}} in build-web', { done })
    case 'off':
      return translate('buildWeb.testing.autoOff', 'off')
    case null:
      return '—'
  }
}

/** The watched tasks, after build-web's WatchView, with the work left counted per kind. */
export function TestingTable({
  entries,
  done,
  onOpenTask
}: {
  entries: BuildWebWatchEntry[]
  /** The statuses the images go out on, as the console names them. */
  done: string
  onOpenTask: (issueId: string, tab: BuildWebCardTab) => void
}): React.JSX.Element {
  const [sorting, setSorting] = useState<Sorting>({ sort: null, dir: 'asc' })
  const onSort = (sort: WatchSort) =>
    setSorting((current) =>
      current.sort === sort
        ? { sort, dir: current.dir === 'asc' ? 'desc' : 'asc' }
        : // Most work and the newest move first; the rest read top to bottom.
          {
            sort,
            dir: sort === 'work' || sort === 'changed' || sort === 'checked' ? 'desc' : 'asc'
          }
    )
  const header = { ...sorting, onSort }
  const rows = sortWatchEntries(entries, sorting.sort, sorting.dir)

  const openWork = (entry: BuildWebWatchEntry, run: BuildWebWatchRun) => {
    if (entry.issue_id) {
      onOpenTask(entry.issue_id, 'build')
    } else if (run.console_url) {
      openUrl(run.console_url)
    }
  }

  return (
    <div className="scrollbar-sleek min-h-0 overflow-auto rounded-md border border-border">
      <table className="w-full min-w-[1040px] table-fixed border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-background">
          <tr className="border-b border-border text-left text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
            <BuildWebSortHeader
              {...header}
              sortKey="task"
              label={translate('buildWeb.testing.task', 'Task')}
              className="w-[30%] pl-3"
            />
            <BuildWebSortHeader
              {...header}
              sortKey="status"
              label={translate('buildWeb.testing.status', 'Status')}
              className="w-40"
            />
            <BuildWebSortHeader
              {...header}
              sortKey="changed"
              label={translate('buildWeb.testing.changed', 'Changed')}
              className="w-36"
            />
            <BuildWebSortHeader
              {...header}
              sortKey="checked"
              label={translate('buildWeb.testing.checked', 'Checked')}
              className="w-36"
            />
            <BuildWebSortHeader
              {...header}
              sortKey="work"
              label={translate('buildWeb.testing.work', 'Image work left')}
            />
            <th className="w-36 py-2">{translate('buildWeb.testing.auto', 'Auto-publish')}</th>
            <th className="w-44 py-2 pr-3">
              {translate('buildWeb.testing.lastAction', 'Last action')}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((entry) => (
            <TestingRow
              key={entry.ticket}
              entry={entry}
              done={done}
              onOpenTask={onOpenTask}
              onOpenWork={openWork}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TestingRow({
  entry,
  done,
  onOpenTask,
  onOpenWork
}: {
  entry: BuildWebWatchEntry
  done: string
  onOpenTask: (issueId: string, tab: BuildWebCardTab) => void
  onOpenWork: (entry: BuildWebWatchEntry, run: BuildWebWatchRun) => void
}): React.JSX.Element {
  const key = taskKeyOf(entry)
  const status = taskStatusOf(entry)
  const jira = jiraStatusShown(entry)
  const run = entry.run
  return (
    <tr className="border-b border-border/60 align-top last:border-b-0 hover:bg-accent">
      <td className="max-w-0 py-2 pl-3">
        <span className="flex min-w-0 items-baseline gap-2">
          {entry.issue_id ? (
            <button
              type="button"
              onClick={() => entry.issue_id && onOpenTask(entry.issue_id, 'overview')}
              className="shrink-0 font-mono text-xs font-medium hover:underline"
            >
              {key}
            </button>
          ) : (
            <span className="shrink-0 font-mono text-xs font-medium">{key}</span>
          )}
          {entry.jira_url ? (
            <button
              type="button"
              onClick={() => entry.jira_url && openUrl(entry.jira_url)}
              className="shrink-0 text-2xs text-muted-foreground hover:text-foreground hover:underline"
            >
              {translate('buildWeb.testing.jira', 'Jira')}
            </button>
          ) : null}
        </span>
        {entry.title ? (
          <span className="mt-0.5 block truncate text-xs text-muted-foreground" title={entry.title}>
            {entry.title}
          </span>
        ) : null}
      </td>
      <td className="py-2">
        <span className="flex flex-wrap items-center gap-1">
          {status ? <StatusChip status={status} /> : null}
          {jira ? <BuildWebToneChip label={jira} tone={jiraStatusTone(jira)} /> : null}
        </span>
      </td>
      <td className="py-2 text-xs text-muted-foreground">{when(entry.status_changed_at)}</td>
      <td className="py-2 text-xs text-muted-foreground">{when(entry.checked_at)}</td>
      <td className="py-2">
        {run ? (
          <span className="flex flex-wrap items-center gap-1">
            {workChips(run).map((chip) => (
              <Tooltip key={chip.kind}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onOpenWork(entry, run)}
                    className="rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <BuildWebToneChip label={workLabel(chip)} tone={WORK_TONE[chip.kind]} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={4}>
                  {workHint(chip, run, done)}
                </TooltipContent>
              </Tooltip>
            ))}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      <td className="py-2 text-xs">{autoLabel(autoKindOf(entry), done)}</td>
      <td className="max-w-0 py-2 pr-3 text-xs">
        {entry.last_action ? (
          <span className="block truncate" title={when(entry.last_action_at)}>
            {entry.last_action}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  )
}
