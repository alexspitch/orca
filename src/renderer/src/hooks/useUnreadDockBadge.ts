import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react'
import {
  createNeedsInputBadgeCountSelector,
  NEEDS_INPUT_BADGE_RECOUNT_MS
} from '@/lib/needs-input-badge-count-selector'
import { createUnreadBadgeCountSelector } from '@/lib/unread-badge-count-selector'
import { useAppStore } from '@/store'
import { selectFloatingWorkspaceHasUnread } from '@/store/selectors'

function setUnreadDockBadgeCountBestEffort(count: number): void {
  const setBadge = window.api?.app?.setUnreadDockBadgeCount
  if (!setBadge) {
    return
  }
  void setBadge(count).catch(() => {
    // Dock sync is best-effort chrome; stale badge state should not affect app use.
  })
}

export function clearUnreadDockBadgeCount(): void {
  setUnreadDockBadgeCountBestEffort(0)
}

/** Zero unless notifications are needs-input only; then the workspaces with an agent waiting on the user. */
function useNeedsInputBadgeCount(enabled: boolean, floatingTerminalOpen: boolean): number {
  const selectNeedsInputBadgeCount = useMemo(() => createNeedsInputBadgeCountSelector(), [])
  const subscribe = useCallback(
    (notify: () => void) => {
      if (!enabled) {
        return () => {}
      }
      const unsubscribe = useAppStore.subscribe(notify)
      // Why: a waiting row ages into "not reporting" with no store write, so time alone must recount.
      const timer = setInterval(notify, NEEDS_INPUT_BADGE_RECOUNT_MS)
      return () => {
        unsubscribe()
        clearInterval(timer)
      }
    },
    [enabled]
  )
  const readCount = useCallback(
    () =>
      enabled
        ? selectNeedsInputBadgeCount(useAppStore.getState(), Date.now(), floatingTerminalOpen)
        : 0,
    [enabled, floatingTerminalOpen, selectNeedsInputBadgeCount]
  )
  // Why not useAppStore: the interval has to re-read without re-rendering the App root each minute.
  return useSyncExternalStore(subscribe, readCount)
}

export function useUnreadDockBadge(
  floatingTerminalOpen: boolean
): typeof clearUnreadDockBadgeCount {
  // Select the badge integer so title frames neither rescan nor rerender the App root.
  const selectUnreadBadgeCount = useMemo(() => createUnreadBadgeCountSelector(), [])
  const unreadWorkspaceCount = useAppStore(selectUnreadBadgeCount)
  // Why: the floating terminal has no workspace flag, so it counts exactly while its launcher shows the dot.
  const floatingTerminalHasUnread = useAppStore(
    (s) => s.settings?.floatingTerminalEnabled === true && selectFloatingWorkspaceHasUnread(s)
  )
  const needsInputOnly = useAppStore((s) => s.settings?.notifications?.agentNeedsInputOnly === true)
  const needsInputCount = useNeedsInputBadgeCount(needsInputOnly, floatingTerminalOpen)
  const unreadCount = needsInputOnly
    ? needsInputCount
    : unreadWorkspaceCount + (floatingTerminalHasUnread && !floatingTerminalOpen ? 1 : 0)

  useEffect(() => {
    setUnreadDockBadgeCountBestEffort(unreadCount)
  }, [unreadCount])

  return clearUnreadDockBadgeCount
}
