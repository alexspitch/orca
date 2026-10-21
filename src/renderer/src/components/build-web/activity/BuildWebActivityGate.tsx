import { useEffect, useRef } from 'react'
import { useAppStore } from '@/store'
import type { BuildWebNotificationRef } from '../../../../../shared/build-web-activity-types'
import { showsBuildWebActivity } from '../../../../../shared/sidebar-button-settings'
import { callBuildWeb } from '../build-web-client'
import { isPageHistoryView } from '../page-history/page-history-store'
import { useBuildWebTarget } from '../use-build-web-data'
import { notificationTarget } from './activity-targets'
import { announceBuildWebNotifications } from './announce-build-web-notifications'
import { useBuildWebActivity } from './build-web-activity-store'
import { freshNotifications } from './fresh-notifications'
import { openActivityTarget } from './open-activity-target'

const POLL_MS = 20_000
const WATCHING_POLL_MS = 4_000
// Why read while hidden at all: a banner is for exactly the time nobody looks at Orca.
const HIDDEN_POLL_MS = 30_000
// Why a minute: a token locked at launch unlocks as soon as a build-web page opens, which reads at once.
const FAILED_POLL_MS = 60_000

/**
 * Reads build-web's bell and task list for the titlebar and announces new bell rows. Renders
 * nothing; mounted once, so the two never read the console twice.
 */
export function BuildWebActivityGate(): null {
  const showTitlebar = useAppStore((s) => showsBuildWebActivity(s.settings))
  const notify = useAppStore(
    (s) => s.settings?.notifications.enabled === true && s.settings.notifications.buildWeb
  )
  // Why: opening a build-web page unlocks the token; read again then instead of a minute later.
  const onBuildWebPage = useAppStore((s) => isPageHistoryView(s.activeView))
  const watching = useBuildWebActivity((s) => s.watching)
  const { target, contextKey } = useBuildWebTarget()
  // The ids already read from this host; null until its first reading, which announces nothing.
  const known = useRef<{ contextKey: string; ids: ReadonlySet<string> } | null>(null)

  useEffect(() => {
    if (!showTitlebar && !notify) {
      useBuildWebActivity.setState({ activity: null })
      return
    }
    let alive = true
    let timer = 0
    const poll = async (): Promise<void> => {
      const hidden = document.visibilityState === 'hidden'
      let delay = hidden ? HIDDEN_POLL_MS : watching ? WATCHING_POLL_MS : POLL_MS
      if (!hidden || notify) {
        try {
          const activity = await callBuildWeb(target, 'activity')
          if (!alive) {
            return
          }
          useBuildWebActivity.setState({ activity })
          const seen = known.current?.contextKey === contextKey ? known.current.ids : null
          const { fresh, known: ids } = freshNotifications(
            seen,
            activity.notifications?.items ?? []
          )
          known.current = { contextKey, ids }
          announceBuildWebNotifications(
            fresh,
            useAppStore.getState().settings?.notifications,
            (ref) => openNotification(ref)
          )
        } catch {
          delay = FAILED_POLL_MS
          if (alive) {
            useBuildWebActivity.setState({ activity: null })
          }
        }
      }
      if (alive) {
        timer = window.setTimeout(() => void poll(), delay)
      }
    }
    const openNotification = (ref: BuildWebNotificationRef): void => {
      const where = notificationTarget(ref)
      const baseUrl = useBuildWebActivity.getState().activity?.baseUrl
      if (where && baseUrl) {
        void openActivityTarget(where, { target, contextKey, baseUrl })
      }
    }
    void poll()
    // Why here: the banner was raised by this reader, for this host.
    const offClick = window.api.notifications.onBuildWebClick((ref) => {
      if (ref) {
        openNotification(ref)
      }
    })
    return () => {
      alive = false
      window.clearTimeout(timer)
      offClick()
    }
  }, [contextKey, notify, onBuildWebPage, showTitlebar, target, watching])

  return null
}
