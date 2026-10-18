import { Bot, SquareTerminal, Star } from 'lucide-react'
import { PaginationBar } from '@/components/task-page/PaginationBar'
import { Checkbox } from '@/components/ui/checkbox'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import type {
  BuildWebIssuePatch,
  BuildWebIssueRow,
  BuildWebUser
} from '../../../../shared/build-web-types'
import { ISSUE_PAGE_SIZE, useBuildWebStore } from './build-web-store'
import { BuildWebToneChip, ProductChip, TypeChip } from './BuildWebToneChip'
import { BuildWebSortHeader } from './BuildWebSortHeader'
import { AssigneePicker, PriorityPicker, StatusPicker } from './BuildWebRowPickers'
import { useBuildWebAssignees } from './use-build-web-data'
import { useIssueRowPatch } from './use-build-web-issue-write'

function IssueRow({
  issue,
  selected,
  open,
  busy,
  users,
  onToggle,
  onOpen,
  onFavorite,
  onPatch
}: {
  issue: BuildWebIssueRow
  selected: boolean
  open: boolean
  busy: boolean
  users: BuildWebUser[]
  onToggle: () => void
  onOpen: () => void
  onFavorite: () => void
  onPatch: (patch: BuildWebIssuePatch) => void
}): React.JSX.Element {
  return (
    <tr
      data-current={open ? 'true' : undefined}
      className={cn('border-b border-border hover:bg-accent', (open || selected) && 'bg-accent')}
    >
      <td className="w-10 py-2 pl-3 md:pl-5">
        <Checkbox
          emphasis="strong"
          checked={selected}
          onCheckedChange={onToggle}
          aria-label={translate('buildWeb.list.select', 'Select {{key}}', { key: issue.key })}
        />
      </td>
      <td className="w-28 py-2 font-mono text-xs text-muted-foreground">{issue.key}</td>
      <td className="w-20 py-2">
        <ProductChip product={issue.product} />
      </td>
      <td className="w-28 py-2">
        <TypeChip type={issue.type} />
      </td>
      <td className="max-w-0 py-2 pr-3">
        <div className="flex min-w-0 items-center gap-1.5">
          {/* As in build-web: the model's queue is marked beside the task. */}
          {issue.for_ai ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="shrink-0 text-chip-tone-purple">
                  <Bot
                    className="size-3.5"
                    aria-label={translate('buildWeb.detail.forAi', 'Handed to AI')}
                  />
                </span>
              </TooltipTrigger>
              <TooltipContent>{translate('buildWeb.detail.forAi', 'Handed to AI')}</TooltipContent>
            </Tooltip>
          ) : null}
          <button
            type="button"
            onClick={onOpen}
            className="block min-w-0 flex-1 truncate text-left text-sm hover:underline focus-visible:underline focus-visible:outline-none"
          >
            {issue.title}
          </button>
        </div>
      </td>
      <td className="w-40 py-2">
        <StatusPicker issue={issue} busy={busy} onPatch={onPatch} />
      </td>
      <td className="w-32 py-2">
        <PriorityPicker issue={issue} busy={busy} onPatch={onPatch} />
      </td>
      <td className="w-28 py-2 pr-2">
        <AssigneePicker issue={issue} users={users} busy={busy} onPatch={onPatch} />
      </td>
      <td className="w-28 py-2">
        {issue.version_name ? (
          <BuildWebToneChip label={issue.version_name} tone={null} mono />
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      <td className="w-24 py-2 text-xs text-muted-foreground">
        {issue.updated_at ? new Date(issue.updated_at).toLocaleDateString() : ''}
      </td>
      <td className="w-16 py-2 pr-3 md:pr-5">
        <div className="flex items-center justify-end gap-1">
          {issue.agent_session ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-chip-tone-blue">
                  <SquareTerminal
                    className="size-3.5"
                    aria-label={translate('buildWeb.list.session', 'Agent session')}
                  />
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {issue.agent_session.agent} · {issue.agent_session.worktree_name}
              </TooltipContent>
            </Tooltip>
          ) : null}
          <button
            type="button"
            onClick={onFavorite}
            aria-pressed={issue.favorite}
            aria-label={translate('buildWeb.list.favorite', 'Favorite {{key}}', { key: issue.key })}
            className="rounded p-1 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Star
              className={cn('size-3.5', issue.favorite && 'fill-current text-chip-tone-amber')}
            />
          </button>
        </div>
      </td>
    </tr>
  )
}

export function BuildWebIssueList({
  onFavorite
}: {
  onFavorite: (issue: BuildWebIssueRow) => void
}): React.JSX.Element {
  const issues = useBuildWebStore((s) => s.issues)
  const total = useBuildWebStore((s) => s.total)
  const loading = useBuildWebStore((s) => s.loading)
  const page = useBuildWebStore((s) => s.page)
  const setPage = useBuildWebStore((s) => s.setPage)
  const sort = useBuildWebStore((s) => s.sort)
  const sortBy = useBuildWebStore((s) => s.sortBy)
  const selected = useBuildWebStore((s) => s.selected)
  const openIssueId = useBuildWebStore((s) => s.openIssueId)
  const toggleSelected = useBuildWebStore((s) => s.toggleSelected)
  const openIssue = useBuildWebStore((s) => s.openIssue)
  const { busy, patch } = useIssueRowPatch()
  const users = useBuildWebAssignees(issues.length > 0)
  const header = { sort: sort.sort, dir: sort.dir, onSort: sortBy }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="scrollbar-sleek min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[1100px] table-fixed border-collapse">
          <thead className="sticky top-0 z-10 bg-background">
            <tr className="border-b border-border text-left text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
              <th className="w-10 py-2 pl-3 md:pl-5">
                <span className="sr-only">{translate('buildWeb.list.selection', 'Selection')}</span>
              </th>
              <BuildWebSortHeader
                {...header}
                sortKey="key"
                label={translate('buildWeb.list.key', 'Key')}
                className="w-28"
              />
              <th className="w-20 py-2">{translate('buildWeb.list.product', 'Product')}</th>
              <BuildWebSortHeader
                {...header}
                sortKey="type"
                label={translate('buildWeb.list.type', 'Type')}
                className="w-28"
              />
              <BuildWebSortHeader
                {...header}
                sortKey="title"
                label={translate('buildWeb.list.title', 'Title')}
              />
              <BuildWebSortHeader
                {...header}
                sortKey="status"
                label={translate('buildWeb.list.status', 'Status')}
                className="w-40"
              />
              <BuildWebSortHeader
                {...header}
                sortKey="priority"
                label={translate('buildWeb.list.priority', 'Priority')}
                className="w-32"
              />
              <th className="w-28 py-2">{translate('buildWeb.list.assignee', 'Assignee')}</th>
              <th className="w-28 py-2">{translate('buildWeb.list.release', 'Release')}</th>
              <BuildWebSortHeader
                {...header}
                sortKey="updated_at"
                label={translate('buildWeb.list.updated', 'Updated')}
                className="w-24"
              />
              <th className="w-16 py-2 pr-3 md:pr-5">
                <span className="sr-only">{translate('buildWeb.list.marks', 'Marks')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {issues.map((issue) => (
              <IssueRow
                key={issue.id}
                issue={issue}
                selected={selected.has(issue.id)}
                open={openIssueId === issue.id}
                busy={busy.has(issue.id)}
                users={users}
                onToggle={() => toggleSelected(issue.id)}
                onOpen={() => openIssue(issue.id)}
                onFavorite={() => onFavorite(issue)}
                onPatch={(change) => void patch(issue, change)}
              />
            ))}
          </tbody>
        </table>
      </div>
      {total > ISSUE_PAGE_SIZE ? (
        <div className="flex items-center justify-between gap-3 border-t border-border px-3 md:px-5">
          <span className="text-xs whitespace-nowrap text-muted-foreground">
            {translate('buildWeb.list.range', '{{from}}–{{to}} of {{total}}', {
              from: page * ISSUE_PAGE_SIZE + 1,
              to: page * ISSUE_PAGE_SIZE + issues.length,
              total
            })}
          </span>
          <PaginationBar
            currentPage={page}
            totalPages={Math.ceil(total / ISSUE_PAGE_SIZE)}
            loadingTarget={loading ? page : null}
            onPageChange={setPage}
          />
        </div>
      ) : null}
    </div>
  )
}
