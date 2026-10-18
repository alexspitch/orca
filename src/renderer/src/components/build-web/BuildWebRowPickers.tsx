import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { translate } from '@/i18n/i18n'
import {
  BUILD_WEB_STATUSES,
  BUILD_WEB_SUBTASK_STATUSES,
  type BuildWebIssuePatch,
  type BuildWebIssueRow,
  type BuildWebUser
} from '../../../../shared/build-web-types'
import { BUILD_WEB_PRIORITIES, loginOf } from './build-web-labels'
import { PriorityChip, StatusChip } from './BuildWebToneChip'

// The status and the priority are changed in the row itself, as in build-web's table: the chip is
// the picker. A subtask is offered only the statuses a subtask may hold.

const triggerClass =
  'max-w-full rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60'

export function StatusPicker({
  issue,
  busy,
  onPatch
}: {
  issue: BuildWebIssueRow
  busy: boolean
  onPatch: (patch: BuildWebIssuePatch) => void
}): React.JSX.Element {
  const statuses = issue.parent_id ? BUILD_WEB_SUBTASK_STATUSES : BUILD_WEB_STATUSES
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={triggerClass}
          disabled={busy}
          aria-label={translate('buildWeb.list.changeStatus', 'Change the status of {{key}}', {
            key: issue.key
          })}
        >
          <StatusChip status={issue.status} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {statuses.map((s) => (
          <DropdownMenuItem
            key={s}
            disabled={s === issue.status}
            onSelect={() => onPatch({ status: s })}
          >
            <StatusChip status={s} />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function PriorityPicker({
  issue,
  busy,
  onPatch
}: {
  issue: BuildWebIssueRow
  busy: boolean
  onPatch: (patch: BuildWebIssuePatch) => void
}): React.JSX.Element {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={triggerClass}
          disabled={busy}
          aria-label={translate('buildWeb.list.changePriority', 'Change the priority of {{key}}', {
            key: issue.key
          })}
        >
          <PriorityChip priority={issue.priority} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {BUILD_WEB_PRIORITIES.map((p) => (
          <DropdownMenuItem
            key={p}
            disabled={p === issue.priority}
            onSelect={() => onPatch({ priority: p })}
          >
            <PriorityChip priority={p} />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** The assignee by login (no mail domain); the menu offers the console's people and nobody. */
export function AssigneePicker({
  issue,
  users,
  busy,
  onPatch
}: {
  issue: BuildWebIssueRow
  users: BuildWebUser[]
  busy: boolean
  onPatch: (patch: BuildWebIssuePatch) => void
}): React.JSX.Element {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={busy}
          title={issue.assignee || undefined}
          aria-label={translate('buildWeb.list.changeAssignee', 'Change the assignee of {{key}}', {
            key: issue.key
          })}
          className="block max-w-full truncate rounded text-left text-xs hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
        >
          {issue.assignee ? (
            loginOf(issue.assignee)
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem disabled={!issue.assignee} onSelect={() => onPatch({ assignee: '' })}>
          {translate('buildWeb.detail.nobody', 'Nobody')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {users.map((u) => (
          <DropdownMenuItem
            key={u.email}
            disabled={u.email === issue.assignee}
            onSelect={() => onPatch({ assignee: u.email })}
          >
            <span>{loginOf(u.email)}</span>
            {u.name && u.name !== loginOf(u.email) ? (
              <span className="text-xs text-muted-foreground">{u.name}</span>
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
