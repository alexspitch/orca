import { beforeEach, describe, expect, it } from 'vitest'
import { useBuildWebStore } from './build-web-store'
import { rememberIssuesPlace, restoreIssuesPlace } from './issues-page-place'
import { setPageHistoryRestoring } from './page-history/page-history-store'

/** What leaving Issues does: the place kept, the card dropped. */
function leave(): void {
  rememberIssuesPlace()
  useBuildWebStore.getState().openIssue(null)
}

beforeEach(() => {
  setPageHistoryRestoring(false)
  useBuildWebStore.getState().openIssue(null)
  restoreIssuesPlace()
})

describe('coming back to Issues', () => {
  it('shows the task left open, on the card’s tab it was on', () => {
    useBuildWebStore.getState().openIssue('i1', true, 'plan')
    leave()
    restoreIssuesPlace()
    expect(useBuildWebStore.getState()).toMatchObject({
      openIssueId: 'i1',
      fullScreen: true,
      openTab: 'plan'
    })
  })

  it('keeps a card a link or Back opened, and the list when nothing was open', () => {
    useBuildWebStore.getState().openIssue('i1', true, 'plan')
    leave()
    useBuildWebStore.getState().openIssue('i2', true)
    restoreIssuesPlace()
    expect(useBuildWebStore.getState().openIssueId).toBe('i2')

    useBuildWebStore.getState().openIssue(null)
    leave()
    restoreIssuesPlace()
    expect(useBuildWebStore.getState().openIssueId).toBeNull()
  })

  it('leaves the page as the history restores it', () => {
    useBuildWebStore.getState().openIssue('i1', true, 'plan')
    leave()
    setPageHistoryRestoring(true)
    restoreIssuesPlace()
    expect(useBuildWebStore.getState().openIssueId).toBeNull()
  })
})
