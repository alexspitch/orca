import React from 'react'
import { CircleDashed, List, Timer } from 'lucide-react'
import { useAppStore } from '@/store'
import { DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { translate } from '@/i18n/i18n'
import type { HideableTaskSessionGroup } from '../../../../shared/sidebar-list/task-session-groups'
import { BUILD_WEB_TASK_FILTER_LABELS } from '../../../../shared/build-web-session-labels'
import { FilterToggleRow } from './FilterToggleRow'
import { selectTaskSessionUiAvailable } from './task-session-capability'

const ROWS: { group: HideableTaskSessionGroup; icon: React.ReactNode }[] = [
  { group: 'none', icon: <CircleDashed className="size-3.5" /> },
  { group: 'progress', icon: <List className="size-3.5" /> },
  { group: 'release', icon: <Timer className="size-3.5" /> }
]

/** IS-147: the task-state filters; Needs attention and unknown states are never hidden. */
export function SidebarTaskSessionFilterRows(): React.JSX.Element | null {
  const hidden = useAppStore((s) => s.hiddenSessionStates)
  const setHidden = useAppStore((s) => s.setHiddenSessionStates)
  const available = useAppStore(selectTaskSessionUiAvailable)
  // Why keep an active filter: it must stay reachable to turn it off.
  if (!available && hidden.length === 0) {
    return null
  }
  return (
    <>
      <DropdownMenuSeparator />
      {ROWS.map((row) => (
        <FilterToggleRow
          key={row.group}
          icon={row.icon}
          label={translate(
            BUILD_WEB_TASK_FILTER_LABELS[row.group].key,
            BUILD_WEB_TASK_FILTER_LABELS[row.group].text
          )}
          checked={hidden.includes(row.group)}
          onChange={(next) =>
            setHidden(next ? [...hidden, row.group] : hidden.filter((group) => group !== row.group))
          }
        />
      ))}
    </>
  )
}
