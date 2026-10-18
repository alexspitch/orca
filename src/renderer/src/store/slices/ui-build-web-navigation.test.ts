import { describe, expect, it } from 'vitest'
import { createUIStore } from './ui-slice-test-harness'

describe('Issues and Images pages', () => {
  it('return to where the user started, however often they switch between them', () => {
    const store = createUIStore()
    store.setState({ activeView: 'terminal' })
    store.getState().openBuildWebPage()
    store.getState().openBuildWebImagesPage()
    store.getState().openBuildWebPage()
    store.getState().closeBuildWebPage()
    expect(store.getState().activeView).toBe('terminal')
    store.getState().openBuildWebImagesPage()
    store.getState().openBuildWebPage()
    store.getState().openBuildWebImagesPage()
    store.getState().closeBuildWebImagesPage()
    expect(store.getState().activeView).toBe('terminal')
  })
})

describe('the Testing page', () => {
  it('returns to where the user started, also after opening a task from it', () => {
    const store = createUIStore()
    store.setState({ activeView: 'tasks' })
    store.getState().openBuildWebTrainsPage()
    store.getState().openBuildWebTestingPage()
    store.getState().closeBuildWebTestingPage()
    expect(store.getState().activeView).toBe('tasks')
    store.getState().openBuildWebTestingPage()
    store.getState().openBuildWebPage()
    store.getState().closeBuildWebPage()
    expect(store.getState().activeView).toBe('tasks')
  })
})
