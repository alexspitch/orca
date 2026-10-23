import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import type {
  BuildWebNotification,
  BuildWebNotificationRef
} from '../../../../../shared/build-web-activity-types'
import type { NotificationSettings } from '../../../../../shared/notification-settings-types'
import { notificationSummary } from './notification-text'

// Past this many at once, one line says how many: a train window failing can raise a dozen rows.
const MAX_SEPARATE = 3

type Alert = { id: string; title: string; body: string; target: BuildWebNotificationRef | null }

function alertsOf(fresh: readonly BuildWebNotification[]): Alert[] {
  if (fresh.length <= MAX_SEPARATE) {
    return fresh.map((n) => ({
      id: n.id,
      title: n.title,
      body: notificationSummary(n),
      target: {
        kind: n.kind,
        issue_id: n.issue_id,
        run_id: n.run_id,
        title: n.title,
        last_at: n.last_at
      }
    }))
  }
  return [
    {
      id: fresh.map((n) => n.id).join(','),
      title: translate('buildWeb.activity.alertMany', 'build-web: {{count}} new notifications', {
        count: fresh.length
      }),
      body: fresh.map((n) => n.title).join(' · '),
      target: null
    }
  ]
}

/**
 * New bell rows as a desktop banner while Orca is in the background, or a toast inside it while it
 * is in front — each behind its own switch in Settings → Notifications.
 */
export function announceBuildWebNotifications(
  fresh: readonly BuildWebNotification[],
  settings: NotificationSettings | undefined,
  open: (target: BuildWebNotificationRef) => void
): void {
  if (fresh.length === 0 || !settings?.enabled || !settings.buildWeb) {
    return
  }
  const inFront = document.hasFocus()
  for (const alert of alertsOf(fresh)) {
    if (!inFront) {
      void window.api.notifications
        .dispatch({
          source: 'build-web',
          notificationId: `build-web:${alert.id}`,
          attentionKey: `build-web:${alert.id}`,
          buildWeb: { title: alert.title, body: alert.body, target: alert.target }
        })
        .catch(() => {})
    } else if (settings.buildWebToastWhenFocused) {
      const target = alert.target
      toast(alert.title, {
        description: alert.body,
        duration: 10_000,
        ...(target
          ? {
              action: {
                label: translate('buildWeb.activity.alertOpen', 'Open'),
                onClick: () => open(target)
              }
            }
          : {})
      })
    }
  }
}
