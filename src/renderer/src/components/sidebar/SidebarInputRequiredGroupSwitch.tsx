import React from 'react'
import { MessageCircleQuestion } from 'lucide-react'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { BUILD_WEB_TASK_INPUT_GROUP_SWITCH_LABEL } from '../../../../shared/build-web-session-labels'
import { FilterToggleRow } from './FilterToggleRow'
import { selectInputRequiredGroupSwitchAvailable } from './task-session-capability'

/** IS-147: «By task»'s Input required group, on by default; off returns its rows to their task lanes. */
export function SidebarInputRequiredGroupSwitch(): React.JSX.Element | null {
  const groupBy = useAppStore((s) => s.groupBy)
  const shown = useAppStore((s) => s.showInputRequiredGroup)
  const setShown = useAppStore((s) => s.setShowInputRequiredGroup)
  const available = useAppStore(selectInputRequiredGroupSwitchAvailable)
  // Why keep a switch that is off: it must stay reachable to turn the group back on.
  if (groupBy !== 'task' || (!available && shown)) {
    return null
  }
  return (
    <FilterToggleRow
      icon={<MessageCircleQuestion className="size-3.5" />}
      label={translate(
        BUILD_WEB_TASK_INPUT_GROUP_SWITCH_LABEL.key,
        BUILD_WEB_TASK_INPUT_GROUP_SWITCH_LABEL.text
      )}
      checked={shown}
      onChange={setShown}
    />
  )
}
