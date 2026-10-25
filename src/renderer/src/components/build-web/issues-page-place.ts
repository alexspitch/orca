import { useBuildWebStore, type BuildWebCardTab } from './build-web-store'
import { isPageHistoryRestoring } from './page-history/page-history-store'

// Where Issues was left: the task open on it and the card's tab, shown again on coming back.

type Place = {
  contextKey: string | null
  openIssueId: string
  fullScreen: boolean
  fullScreenFromDrawer: boolean
  openTab: BuildWebCardTab
}

let left: Place | null = null

/** Called as the page is left, before it drops its card. */
export function rememberIssuesPlace(): void {
  const { contextKey, openIssueId, fullScreen, fullScreenFromDrawer, openTab } =
    useBuildWebStore.getState()
  left = openIssueId ? { contextKey, openIssueId, fullScreen, fullScreenFromDrawer, openTab } : null
}

/**
 * Called as the page opens. Back and a link name what to show themselves: a card already open,
 * or the page history restoring, keeps theirs. Another build-web host's task means nothing here.
 */
export function restoreIssuesPlace(): void {
  const place = left
  left = null
  const store = useBuildWebStore.getState()
  if (
    !place ||
    isPageHistoryRestoring() ||
    store.openIssueId ||
    store.contextKey !== place.contextKey
  ) {
    return
  }
  const { contextKey: _host, ...card } = place
  useBuildWebStore.setState(card)
}
