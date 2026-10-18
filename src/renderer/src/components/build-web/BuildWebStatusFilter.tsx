import { ChevronDown, ListTodo } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Toggle } from '@/components/ui/toggle'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { translate } from '@/i18n/i18n'
import { BUILD_WEB_STATUSES, type BuildWebStatus } from '../../../../shared/build-web-types'
import { OPEN_STATUSES, sameStatuses, TO_WORK_STATUSES, useBuildWebStore } from './build-web-store'
import { statusLabel } from './build-web-labels'
import { StatusChip } from './BuildWebToneChip'

/** What the status button says: a preset's name, the one status, or how many. */
function summaryOf(statuses: ReadonlySet<BuildWebStatus>): string {
  if (statuses.size === 0) {
    return translate('buildWeb.filters.anyStatus', 'Any status')
  }
  if (sameStatuses(statuses, OPEN_STATUSES)) {
    return translate('buildWeb.filters.open', 'Open')
  }
  if (sameStatuses(statuses, TO_WORK_STATUSES)) {
    return translate('buildWeb.filters.toWork', 'To work')
  }
  const only = BUILD_WEB_STATUSES.find((s) => statuses.has(s))
  return statuses.size === 1 && only
    ? statusLabel(only)
    : translate('buildWeb.filters.statusCount', '{{count}} statuses', { count: statuses.size })
}

/** Several statuses at once, with the console's presets one click away. */
export function BuildWebStatusFilter(): React.JSX.Element {
  const statuses = useBuildWebStore((s) => s.statuses)
  const toggleStatus = useBuildWebStore((s) => s.toggleStatus)
  const setStatuses = useBuildWebStore((s) => s.setStatuses)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label={translate('buildWeb.filters.status', 'Status')}
        >
          {summaryOf(statuses)}
          <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onSelect={() => setStatuses(OPEN_STATUSES)}>
          {translate('buildWeb.filters.open', 'Open')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setStatuses(TO_WORK_STATUSES)}>
          {translate('buildWeb.filters.toWork', 'To work')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setStatuses([])}>
          {translate('buildWeb.filters.anyStatus', 'Any status')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {BUILD_WEB_STATUSES.map((s) => (
          <DropdownMenuCheckboxItem
            key={s}
            checked={statuses.has(s)}
            // Why: the menu stays open so several statuses are ticked in one go.
            onSelect={(event) => event.preventDefault()}
            onCheckedChange={() => toggleStatus(s)}
          >
            <StatusChip status={s} />
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** The «To work» quick filter: To do, Planned, In progress and Build failed; off goes back to open. */
export function BuildWebToWorkToggle(): React.JSX.Element {
  const statuses = useBuildWebStore((s) => s.statuses)
  const setStatuses = useBuildWebStore((s) => s.setStatuses)
  const on = sameStatuses(statuses, TO_WORK_STATUSES)
  return (
    <Toggle
      variant="outline"
      size="sm"
      pressed={on}
      onPressedChange={(pressed) => setStatuses(pressed ? TO_WORK_STATUSES : OPEN_STATUSES)}
    >
      <ListTodo />
      {translate('buildWeb.filters.toWork', 'To work')}
    </Toggle>
  )
}
