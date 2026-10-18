import type { BuildWebView, UiViewHistory } from './ui-slice-contract-core'
import type { UISlice, UISliceSet } from './ui-slice-contract'

/** A view the Git page can return to: never itself, never a build-web page that would send it back. */
export type GitLogOrigin = Exclude<UiViewHistory, 'git-log' | BuildWebView>

export type UISliceGitLogPage = {
  /** Where the Git page returns to when it closes. */
  previousViewBeforeGitLog: GitLogOrigin
  openGitLogPage: () => void
  closeGitLogPage: () => void
}

/**
 * Where the Git page goes back to. Opened from a build-web page, it takes that page's origin, so
 * switching between them never makes each the other's way back.
 */
export function gitLogOrigin(state: UISlice): GitLogOrigin {
  const viaBuildWeb = (origin: Exclude<UiViewHistory, BuildWebView>): GitLogOrigin =>
    origin === 'git-log' ? state.previousViewBeforeGitLog : origin
  const view = state.activeView
  if (view === 'git-log') {
    return state.previousViewBeforeGitLog
  }
  if (view === 'build-web') {
    return viaBuildWeb(state.previousViewBeforeBuildWeb)
  }
  if (view === 'build-web-images') {
    return viaBuildWeb(state.previousViewBeforeBuildWebImages)
  }
  return view === 'build-web-trains' ? viaBuildWeb(state.previousViewBeforeBuildWebTrains) : view
}

export function createUiGitLogActions(set: UISliceSet): UISliceGitLogPage {
  return {
    previousViewBeforeGitLog: 'terminal',
    openGitLogPage: () =>
      set((state) => ({ activeView: 'git-log', previousViewBeforeGitLog: gitLogOrigin(state) })),
    closeGitLogPage: () => set((state) => ({ activeView: state.previousViewBeforeGitLog }))
  }
}
