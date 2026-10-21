import { useState } from 'react'
import { ListChecks } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { formatUiRelativeTimeFromDate } from '@/i18n/relative-time-format'
import type { BuildWebConsoleTask } from '../../../../../shared/build-web-activity-types'
import { BuildWebJobPanel } from '../BuildWebJobPanel'
import { BuildWebToneChip } from '../BuildWebToneChip'
import { taskTarget, taskTone } from './activity-targets'
import { ActivityCountBadge } from './ActivityCountBadge'
import { openActivityTarget, type ActivityHost } from './open-activity-target'

// Beyond these a line says how many were left out, as the console's own list does.
const MAX_ACTIVE = 5
const MAX_DONE = 12

function TaskRow({
  task,
  host,
  onLog
}: {
  task: BuildWebConsoleTask
  host: ActivityHost
  onLog: (task: BuildWebConsoleTask) => void
}): React.JSX.Element {
  const where = taskTarget(task)
  const at = task.active ? task.started_at || task.created_at : task.finished_at || task.created_at
  const line = [task.detail, at ? formatUiRelativeTimeFromDate(at, '') : '']
    .filter(Boolean)
    .join(' · ')
  return (
    <DropdownMenuItem
      disabled={!where}
      onSelect={() => {
        if (where?.kind === 'job') {
          onLog(task)
        } else if (where) {
          void openActivityTarget(where, host)
        }
      }}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate">{task.title}</span>
        {line ? (
          <span className="block truncate text-2xs text-muted-foreground">{line}</span>
        ) : null}
      </span>
      <BuildWebToneChip label={task.status} tone={taskTone(task.status)} />
    </DropdownMenuItem>
  )
}

function MoreLine({ text }: { text: string }): React.JSX.Element {
  return <p className="px-2 py-1 text-2xs text-muted-foreground">{text}</p>
}

/**
 * build-web's long-running work in one list — stand jobs, image builds, test runs — with the count
 * of what is going now. A job opens on its log; a build on its task's card.
 */
export function BuildWebTaskMenu({
  tasks,
  host,
  onOpenChange
}: {
  tasks: BuildWebConsoleTask[]
  host: ActivityHost
  /** Open is when somebody watches a status change: the parent reads faster then. */
  onOpenChange: (open: boolean) => void
}): React.JSX.Element {
  const [logOf, setLogOf] = useState<BuildWebConsoleTask | null>(null)
  const active = tasks.filter((t) => t.active)
  const done = tasks.filter((t) => !t.active)
  const label =
    active.length > 0
      ? translate('buildWeb.activity.tasksRunning', 'build-web tasks, {{count}} running', {
          count: active.length
        })
      : translate('buildWeb.activity.tasks', 'build-web tasks')
  const row = (task: BuildWebConsoleTask) => (
    <TaskRow key={task.key} task={task} host={host} onLog={setLogOf} />
  )

  return (
    <>
      <DropdownMenu onOpenChange={onOpenChange}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <button className="sidebar-toggle sidebar-toggle-compact relative" aria-label={label}>
                <ListChecks size={14} />
                <ActivityCountBadge count={active.length} tone="primary" />
              </button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6}>
            {label}
          </TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="start" className="w-96">
          <DropdownMenuLabel>
            {translate('buildWeb.activity.tasksTitle', 'Tasks')}
          </DropdownMenuLabel>
          {tasks.length === 0 ? (
            <MoreLine text={translate('buildWeb.activity.noTasks', 'Nothing is running')} />
          ) : null}
          {active.slice(0, MAX_ACTIVE).map(row)}
          {active.length > MAX_ACTIVE ? (
            <MoreLine
              text={translate('buildWeb.activity.moreRunning', '{{count}} more running', {
                count: active.length - MAX_ACTIVE
              })}
            />
          ) : null}
          {active.length > 0 && done.length > 0 ? <DropdownMenuSeparator /> : null}
          {done.slice(0, MAX_DONE).map(row)}
          {done.length > MAX_DONE ? (
            <MoreLine
              text={translate('buildWeb.activity.moreDone', '{{count}} more finished', {
                count: done.length - MAX_DONE
              })}
            />
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={logOf !== null} onOpenChange={(open) => !open && setLogOf(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{logOf?.title}</DialogTitle>
            {logOf?.detail ? <DialogDescription>{logOf.detail}</DialogDescription> : null}
          </DialogHeader>
          {logOf ? (
            <BuildWebJobPanel
              key={logOf.id}
              target={host.target}
              jobId={logOf.id}
              label={logOf.kind}
              onJob={() => {}}
              onDone={() => {}}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
