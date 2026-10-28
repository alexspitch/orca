import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { PaginationBar } from '@/components/task-page/PaginationBar'
import { translate } from '@/i18n/i18n'
import {
  BUILD_WEB_TASK_KINDS,
  BUILD_WEB_TASK_PAGE_SIZES,
  BUILD_WEB_TASK_STATES,
  type BuildWebConsoleTask
} from '../../../../../shared/build-web-activity-types'
import {
  hasTaskFilters,
  NO_TASK_FILTERS,
  taskPageArgs,
  type BuildWebTaskFilters
} from '../../../../../shared/build-web-task-page'
import { BuildWebToneChip } from '../BuildWebToneChip'
import { FilterChips } from '../images/FilterChips'
import { ImageSearch } from '../images/image-view-parts'
import { toggled } from '../images/use-build-web-images'
import { DateBound } from '../recaps/RecapsFilterBar'
import { buildPageUrl, taskTone } from './activity-targets'
import type { ActivityHost } from './open-activity-target'
import { BuildPageButton } from './TaskViewDialog'
import { taskKindText, taskStateText } from './task-text'
import { useTaskPage } from './use-task-page'

const EVERYBODY = '__everybody__'
const SEARCH_DEBOUNCE_MS = 300

function whenOf(task: BuildWebConsoleTask): string {
  const at = task.started_at || task.created_at
  const date = new Date(at)
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleString(undefined, {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
}

/**
 * IS-10, the console's /tasks inside Orca: every task, newest first, narrowed by kind, status,
 * author, period and text, a page at a time. A row opens where the menu's rows open.
 */
export function BuildWebAllTasksDialog({
  open,
  host,
  onOpenChange,
  onTask,
  onBuildPage
}: {
  open: boolean
  host: ActivityHost
  onOpenChange: (open: boolean) => void
  onTask: (task: BuildWebConsoleTask) => void
  onBuildPage: (task: BuildWebConsoleTask, url: string) => void
}): React.JSX.Element {
  const [filters, setFilters] = useState<BuildWebTaskFilters>(NO_TASK_FILTERS)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [perPage, setPerPage] = useState<number>(BUILD_WEB_TASK_PAGE_SIZES[0])
  const narrow = (next: Partial<BuildWebTaskFilters>) => {
    setFilters((current) => ({ ...current, ...next }))
    setPage(0)
  }
  useEffect(() => {
    const timer = window.setTimeout(() => narrow({ q: search }), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [search])
  const {
    page: data,
    loading,
    error
  } = useTaskPage(host, taskPageArgs(filters, page, perPage), open)
  const total = data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / perPage))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] flex-col sm:max-w-[min(1100px,94vw)]">
        <DialogHeader>
          <DialogTitle>{translate('buildWeb.tasks.allTitle', 'All tasks')}</DialogTitle>
          <DialogDescription>
            {translate('buildWeb.tasks.found', '{{count}} found', { count: total })}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <ImageSearch
              value={search}
              wide
              placeholder={translate(
                'buildWeb.tasks.search',
                'Search: ticket, branch, stand, image…'
              )}
              onChange={setSearch}
            />
            <Select
              value={filters.user || EVERYBODY}
              onValueChange={(user) => narrow({ user: user === EVERYBODY ? '' : user })}
            >
              <SelectTrigger size="sm" className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={EVERYBODY}>
                  {translate('buildWeb.tasks.everybody', 'Everybody')}
                </SelectItem>
                {(data?.users ?? []).map((user) => (
                  <SelectItem key={user} value={user}>
                    {user}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DateBound
              label={translate('buildWeb.tasks.from', 'From')}
              value={filters.from}
              max={filters.to || undefined}
              onChange={(from) => narrow({ from })}
            />
            <DateBound
              label={translate('buildWeb.tasks.to', 'To')}
              value={filters.to}
              min={filters.from || undefined}
              onChange={(to) => narrow({ to })}
            />
            {hasTaskFilters(filters) ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('')
                  narrow(NO_TASK_FILTERS)
                }}
              >
                {translate('buildWeb.tasks.reset', 'Reset')}
              </Button>
            ) : null}
            {loading ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
          </div>
          <FilterChips
            options={BUILD_WEB_TASK_STATES}
            selected={filters.states}
            label={taskStateText}
            onToggle={(state) => narrow({ states: toggled(filters.states, state) })}
          />
          <FilterChips
            options={BUILD_WEB_TASK_KINDS}
            selected={filters.kinds}
            label={taskKindText}
            onToggle={(kind) => narrow({ kinds: toggled(filters.kinds, kind) })}
          />
        </div>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <div className="scrollbar-sleek min-h-0 flex-1 overflow-auto">
          <table className="w-full table-fixed border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-background">
              <tr className="border-b border-border text-left text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
                <th className="py-2">{translate('buildWeb.tasks.task', 'Task')}</th>
                <th className="w-32 py-2">{translate('buildWeb.tasks.date', 'Date')}</th>
                <th className="w-36 py-2">{translate('buildWeb.tasks.kind', 'Kind')}</th>
                <th className="w-24 py-2">{translate('buildWeb.tasks.status', 'Status')}</th>
                <th className="w-48 py-2">{translate('buildWeb.tasks.author', 'Author')}</th>
              </tr>
            </thead>
            <tbody>
              {(data?.tasks ?? []).map((task) => {
                const url = buildPageUrl(task, host.baseUrl)
                return (
                  <tr
                    key={task.key}
                    className="cursor-pointer border-b border-border hover:bg-accent"
                    onClick={() => onTask(task)}
                  >
                    <td className="max-w-0 py-1.5 pr-2">
                      <span className="flex items-center gap-1">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">{task.title}</span>
                          {task.detail ? (
                            <span className="block truncate text-2xs text-muted-foreground">
                              {task.detail}
                            </span>
                          ) : null}
                        </span>
                        {url ? <BuildPageButton onOpen={() => onBuildPage(task, url)} /> : null}
                      </span>
                    </td>
                    <td className="py-1.5 text-muted-foreground">{whenOf(task)}</td>
                    <td className="py-1.5">{taskKindText(task.kind)}</td>
                    <td className="py-1.5">
                      <BuildWebToneChip label={task.status} tone={taskTone(task.status)} />
                    </td>
                    <td className="truncate py-1.5 text-muted-foreground">{task.user ?? ''}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {data && data.tasks.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {translate('buildWeb.tasks.none', 'No tasks match')}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={String(perPage)}
            onValueChange={(value) => {
              setPerPage(Number(value))
              setPage(0)
            }}
          >
            <SelectTrigger size="sm" className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BUILD_WEB_TASK_PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {translate('buildWeb.tasks.perPage', '{{count}} per page', { count: size })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex-1" />
          {pages > 1 ? (
            <PaginationBar
              currentPage={page}
              totalPages={pages}
              loadingTarget={loading ? page : null}
              onPageChange={setPage}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
