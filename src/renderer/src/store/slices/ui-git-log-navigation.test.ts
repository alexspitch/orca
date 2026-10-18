import { describe, expect, it } from 'vitest'
import { createUIStore } from './ui-slice-test-harness'

describe('Git page', () => {
  it('returns to the view it was opened from, even when opened twice', () => {
    const store = createUIStore()
    store.setState({ activeView: 'tasks' })
    store.getState().openGitLogPage()
    store.getState().openGitLogPage()
    expect(store.getState().activeView).toBe('git-log')
    store.getState().closeGitLogPage()
    expect(store.getState().activeView).toBe('tasks')
  })

  it('goes back to the terminal by default', () => {
    const store = createUIStore()
    store.getState().closeGitLogPage()
    expect(store.getState().activeView).toBe('terminal')
  })

  it('never bounces with the build-web pages: both lead back to where the first one opened', () => {
    const store = createUIStore()
    store.setState({ activeView: 'terminal' })
    store.getState().openBuildWebPage()
    store.getState().openGitLogPage()
    store.getState().openBuildWebPage()
    store.getState().closeBuildWebPage()
    expect(store.getState().activeView).toBe('terminal')

    store.getState().openGitLogPage()
    store.getState().openBuildWebImagesPage()
    store.getState().openGitLogPage()
    store.getState().closeGitLogPage()
    expect(store.getState().activeView).toBe('terminal')
  })
})
