import { useState } from 'react'
import { ListChecks, Rows3 } from 'lucide-react'
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
import { BuildWebToneChip } from '../BuildWebToneChip'
import { buildPageUrl, taskTarget, taskTone } from './activity-targets'
import { BuildWebAllTasksDialog } from './BuildWebAllTasksDialog'
import { ActivityCountBadge } from './ActivityCountBadge'
import { openActivityTarget, type ActivityHost } from './open-activity-target'
import { BuildPageButton, TaskViewDialog, type TaskView } from './TaskViewDialog'

// Beyond these a line says how many were left out, as the console's own list does.
const MAX_ACTIVE = 5
const MAX_DONE = 12

/** Where a task opens: a console job over Orca as its log, anything else on its page in Orca. */
function openTask(task: BuildWebConsoleTask, host: ActivityHost, show: (view: TaskView) => void) {
  const where = taskTarget(task)
  if (where?.kind === 'job') {
    show({ kind: 'job', task })
  } else if (where) {
    void openActivityTarget(where, host)
  }
}

function TaskRow({
  task,
  host,
  onShow
}: {
  task: BuildWebConsoleTask
  host: ActivityHost
  onShow: (view: TaskView) => void
}): React.JSX.Element {
  const page = buildPageUrl(task, host.baseUrl)
  const at = task.active ? task.started_at || task.created_at : task.finished_at || task.created_at
  const line = [task.detail, at ? formatUiRelativeTimeFromDate(at, '') : '']
    .filter(Boolean)
    .join(' · ')
  return (
    <DropdownMenuItem disabled={!taskTarget(task)} onSelect={() => openTask(task, host, onShow)}>
      <span className="min-w-0 flex-1">
        <span className="block truncate">{task.title}</span>
        {line ? (
          <span className="block truncate text-2xs text-muted-foreground">{line}</span>
        ) : null}
      </span>
      {page ? (
        <BuildPageButton onOpen={() => onShow({ kind: 'build-page', task, url: page })} />
      ) : null}
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
  const [view, setView] = useState<TaskView | null>(null)
  const [allOpen, setAllOpen] = useState(false)
  const active = tasks.filter((t) => t.active)
  const done = tasks.filter((t) => !t.active)
  const label =
    active.length > 0
      ? translate('buildWeb.activity.tasksRunning', 'build-web tasks, {{count}} running', {
          count: active.length
        })
      : translate('buildWeb.activity.tasks', 'build-web tasks')
  const row = (task: BuildWebConsoleTask) => (
    <TaskRow key={task.key} task={task} host={host} onShow={setView} />
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
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setAllOpen(true)}>
            <Rows3 />
            {translate('buildWeb.activity.allTasks', 'All tasks')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <BuildWebAllTasksDialog
        open={allOpen}
        host={host}
        onOpenChange={setAllOpen}
        onTask={(task) => {
          setAllOpen(false)
          openTask(task, host, setView)
        }}
        onBuildPage={(task, url) => setView({ kind: 'build-page', task, url })}
      />
      <TaskViewDialog view={view} host={host} onClose={() => setView(null)} />
    </>
  )
}
