import { EyeOff } from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { showsBuildWebActivity } from '../../../../../shared/sidebar-button-settings'
import { useBuildWebTarget } from '../use-build-web-data'
import { useBuildWebActivity } from './build-web-activity-store'
import { BuildWebNotificationMenu } from './BuildWebNotificationMenu'
import { BuildWebTaskMenu } from './BuildWebTaskMenu'

const setWatching = (watching: boolean): void => useBuildWebActivity.setState({ watching })

/** build-web's bell and task counter, each an icon with its number, as the console's toolbar has. */
export function TitlebarBuildWebActivity(): React.JSX.Element | null {
  const show = useAppStore((s) => showsBuildWebActivity(s.settings))
  const updateSettings = useAppStore((s) => s.updateSettings)
  const { target, contextKey } = useBuildWebTarget()
  const activity = useBuildWebActivity((s) => s.activity)
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
            <BuildWebTaskMenu tasks={activity.tasks} host={host} onOpenChange={setWatching} />
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
