import { useEffect } from 'react'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { useBuildWebStore } from '../build-web-store'
import {
  backIndex,
  forwardIndex,
  isPageHistoryView,
  recordPage,
  setPageHistoryRestoring,
  usePageHistory,
  type PageEntry,
  type PageHistoryView
} from './page-history-store'

const onPage = () => isPageHistoryView(useAppStore.getState().activeView)

/** Show the page at `index` as it was left: its view, the card open on it, the report picked. */
export function showPage(index: number): void {
  const entry = usePageHistory.getState().entries[index]
  if (!entry) {
    return
  }
  setPageHistoryRestoring(true)
  try {
    usePageHistory.setState({
      index,
      shownRecap: entry.kind === 'recap' ? entry.recap : null
    })
    useBuildWebStore.setState(
      entry.kind === 'issue'
        ? {
            openIssueId: entry.issueId,
            fullScreen: entry.fullScreen,
            fullScreenFromDrawer: entry.fullScreenFromDrawer,
            openTab: entry.tab
          }
        : { openIssueId: null, fullScreen: false, fullScreenFromDrawer: false }
    )
    useAppStore.getState().setActiveView(entry.kind === 'recap' ? 'build-web-recaps' : entry.view)
  } finally {
    // Why a macrotask: the page left clears its card on unmount, in React's commit after this.
    setTimeout(() => setPageHistoryRestoring(false), 0)
  }
}

export function goBackPage(): void {
  const target = backIndex(usePageHistory.getState(), onPage())
  if (target !== null) {
    showPage(target)
  }
}

export function goForwardPage(): void {
  const target = forwardIndex(usePageHistory.getState())
  if (target !== null) {
    showPage(target)
  }
}

export function pageViewLabel(view: PageHistoryView): string {
  switch (view) {
    case 'build-web':
      return translate('buildWeb.sidebar.issues', 'Issues')
    case 'build-web-images':
      return translate('buildWeb.sidebar.images', 'Images')
    case 'build-web-trains':
      return translate('buildWeb.sidebar.trains', 'Trains')
    case 'build-web-testing':
      return translate('buildWeb.sidebar.testing', 'Testing')
    case 'build-web-recaps':
      return translate('buildWeb.sidebar.recaps', 'Recaps')
    case 'build-web-stands':
      return translate('buildWeb.sidebar.stands', 'Stands')
  }
}

/** How a page reads in the history list and on the Back button. */
export function pageLabel(entry: PageEntry): string {
  if (entry.kind === 'view') {
    return pageViewLabel(entry.view)
  }
  if (entry.kind === 'issue') {
    return entry.label ?? translate('buildWeb.history.task', 'Task')
  }
  const at = new Date(entry.recap.finished_at)
  const when = Number.isNaN(at.getTime())
    ? ''
    : ` · ${at.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' })}`
  return `${pageViewLabel('build-web-recaps')} · ${entry.recap.name}${when}`
}

function issueLabel(issueId: string): string | null {
  const row = useBuildWebStore.getState().issues.find((i) => i.id === issueId)
  return row ? `${row.key} · ${row.title}` : null
}

/**
 * Records the pages as they are shown: a build-web page when it comes up, a task's card when it
 * opens or changes its tab, and the list again when the card closes on it. Mounted once.
 */
export function usePageHistoryRecording(): void {
  useEffect(() => {
    const offView = useAppStore.subscribe((state, prev) => {
      if (state.activeView !== prev.activeView && isPageHistoryView(state.activeView)) {
        const card = useBuildWebStore.getState()
        if (!card.openIssueId || !recordCard(card, state.activeView)) {
          recordPage({ kind: 'view', view: state.activeView })
        }
      }
    })
    const offCard = useBuildWebStore.subscribe((card, prev) => {
      const view = useAppStore.getState().activeView
      if (
        card.openIssueId === prev.openIssueId &&
        card.fullScreen === prev.fullScreen &&
        card.openTab === prev.openTab
      ) {
        return
      }
      if (card.openIssueId) {
        recordCard(card, view)
      } else if (prev.openIssueId && (view === 'build-web' || view === 'build-web-testing')) {
        recordPage({ kind: 'view', view })
      }
    })
    return () => {
      offView()
      offCard()
    }
  }, [])
}

function recordCard(card: ReturnType<typeof useBuildWebStore.getState>, view: string): boolean {
  if (!card.openIssueId || (view !== 'build-web' && view !== 'build-web-testing')) {
    return false
  }
  recordPage({
    kind: 'issue',
    view,
    issueId: card.openIssueId,
    label: issueLabel(card.openIssueId),
    fullScreen: card.fullScreen,
    fullScreenFromDrawer: card.fullScreenFromDrawer,
    tab: card.openTab
  })
  return true
}
