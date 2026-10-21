import { create } from 'zustand'
import type { BuildWebRecap } from '../../../../../shared/build-web-recap-types'
import type { BuildWebCardTab } from '../build-web-store'

// The history of the pages opened by links inside Orca — build-web's pages, a task's card, a
// report. Apart from the workspace Back/Forward on purpose: switching workspaces never enters it,
// and it lists the last pages opened.

export const PAGE_HISTORY_VIEWS = [
  'build-web',
  'build-web-images',
  'build-web-trains',
  'build-web-testing',
  'build-web-recaps',
  'build-web-stands'
] as const
export type PageHistoryView = (typeof PAGE_HISTORY_VIEWS)[number]

export const isPageHistoryView = (view: string): view is PageHistoryView =>
  PAGE_HISTORY_VIEWS.some((v) => v === view)

export type PageEntry =
  | { kind: 'view'; view: PageHistoryView }
  | {
      kind: 'issue'
      view: 'build-web' | 'build-web-testing'
      issueId: string
      /** The key and title once known; the card fills them in when it reads the task. */
      label: string | null
      fullScreen: boolean
      fullScreenFromDrawer: boolean
      tab: BuildWebCardTab
    }
  | { kind: 'recap'; recap: BuildWebRecap }

const MAX_ENTRIES = 50
export const RECENT_PAGE_COUNT = 10

/** One page, however it was shown: a card collapsed or on another tab is still that card. */
export function pageEntryKey(entry: PageEntry): string {
  if (entry.kind === 'view') {
    return `view:${entry.view}`
  }
  return entry.kind === 'issue' ? `issue:${entry.view}:${entry.issueId}` : `recap:${entry.recap.id}`
}

type PageHistoryState = {
  entries: PageEntry[]
  /** The page shown last; -1 when none. */
  index: number
  /** A report shown again from the history, for the Recaps page to pick up. */
  shownRecap: BuildWebRecap | null
}

export const usePageHistory = create<PageHistoryState>()(() => ({
  entries: [],
  index: -1,
  shownRecap: null
}))

let suppressed = 0
let restoring = false

/** True while a history move is being applied: the pages it leaves must not undo what it sets. */
export const isPageHistoryRestoring = (): boolean => restoring

export function setPageHistoryRestoring(value: boolean): void {
  restoring = value
}

/** Opens what `open` opens without recording it: a link that records its own target instead. */
export function withoutPageRecording(open: () => void): void {
  suppressed++
  try {
    open()
  } finally {
    suppressed--
  }
}

/** A page shown: appended, or — the same page again — updated in place, so a card keeps its tab. */
export function recordPage(entry: PageEntry): void {
  if (suppressed > 0 || restoring) {
    return
  }
  usePageHistory.setState((s) => {
    const current = s.entries[s.index]
    if (current && pageEntryKey(current) === pageEntryKey(entry)) {
      const entries = s.entries.slice()
      entries[s.index] =
        entry.kind === 'issue' && current.kind === 'issue' && !entry.label
          ? { ...entry, label: current.label }
          : entry
      return { entries }
    }
    // Why truncate: a new page after going back starts a new branch, as in a browser.
    const entries = [...s.entries.slice(0, s.index + 1), entry].slice(-MAX_ENTRIES)
    return { entries, index: entries.length - 1 }
  })
}

/** The key and title of a task, learned after its card was recorded. */
export function labelIssuePage(issueId: string, label: string): void {
  usePageHistory.setState((s) =>
    s.entries.some((e) => e.kind === 'issue' && e.issueId === issueId && e.label !== label)
      ? {
          entries: s.entries.map((e) =>
            e.kind === 'issue' && e.issueId === issueId ? { ...e, label } : e
          )
        }
      : s
  )
}

/**
 * Where Back goes. Away from build-web's pages (in a workspace, on Tasks) it is the page left last;
 * on one of them, the page before it.
 */
export function backIndex(state: PageHistoryState, onPage: boolean): number | null {
  const target = onPage ? state.index - 1 : state.index
  return target >= 0 && target < state.entries.length ? target : null
}

export function forwardIndex(state: PageHistoryState): number | null {
  return state.index + 1 < state.entries.length ? state.index + 1 : null
}

/** The last pages opened, each once and the newest first, with where each sits in the history. */
export function recentPages(
  state: Pick<PageHistoryState, 'entries'>,
  count = RECENT_PAGE_COUNT
): { entry: PageEntry; index: number }[] {
  const seen = new Set<string>()
  const out: { entry: PageEntry; index: number }[] = []
  for (let i = state.entries.length - 1; i >= 0 && out.length < count; i--) {
    const key = pageEntryKey(state.entries[i])
    if (!seen.has(key)) {
      seen.add(key)
      out.push({ entry: state.entries[i], index: i })
    }
  }
  return out
}
