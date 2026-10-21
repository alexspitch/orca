import { useState } from 'react'
import { EyeOff } from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import type { BuildWebActivity } from '../../../../../shared/build-web-activity-types'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import { showsBuildWebActivity } from '../../../../../shared/sidebar-button-settings'
import { useBuildWebBadge } from '../../sidebar/use-build-web-badge'
import { callBuildWeb } from '../build-web-client'
import { useBuildWebTarget } from '../use-build-web-data'
import { BuildWebNotificationMenu } from './BuildWebNotificationMenu'
import { BuildWebTaskMenu } from './BuildWebTaskMenu'

const POLL_MS = 20_000
// Why faster only for tasks: a status changing is watched; the bell's open list is not re-read under the reader.
const TASKS_OPEN_POLL_MS = 4_000

const readActivity = (target: RuntimeClientTarget): Promise<BuildWebActivity> =>
  callBuildWeb(target, 'activity')

/** build-web's bell and task counter, each an icon with its number, as the console's toolbar has. */
export function TitlebarBuildWebActivity(): React.JSX.Element | null {
  const show = useAppStore((s) => showsBuildWebActivity(s.settings))
  const updateSettings = useAppStore((s) => s.updateSettings)
  const { target, contextKey } = useBuildWebTarget()
  const [tasksOpen, setTasksOpen] = useState(false)
  const activity = useBuildWebBadge(show, readActivity, tasksOpen ? TASKS_OPEN_POLL_MS : POLL_MS)
  // Why hidden until read: not connected, locked, or no rights is the usual state — not an error.
  if (!show || !activity || (!activity.notifications && !activity.tasks)) {
    return null
  }
  const host = { target, contextKey, baseUrl: activity.baseUrl }
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          role="group"
          aria-label={translate('buildWeb.activity.group', 'build-web')}
          className="flex shrink-0 items-center"
        >
          {activity.notifications ? (
            <BuildWebNotificationMenu notes={activity.notifications} host={host} />
          ) : null}
          {activity.tasks ? (
            <BuildWebTaskMenu tasks={activity.tasks} host={host} onOpenChange={setTasksOpen} />
          ) : null}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={() => void updateSettings({ showBuildWebActivity: false })}>
          <EyeOff className="size-3.5" />
          {translate('buildWeb.activity.hide', 'Hide from titlebar')}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
