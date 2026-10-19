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

describe('the Recaps page', () => {
  it('returns to where the user started, through the other build-web pages and Git', () => {
    const store = createUIStore()
    store.setState({ activeView: 'tasks' })
    store.getState().openBuildWebTestingPage()
    store.getState().openBuildWebRecapsPage()
    store.getState().closeBuildWebRecapsPage()
    expect(store.getState().activeView).toBe('tasks')
    store.getState().openBuildWebRecapsPage()
    store.getState().openGitLogPage()
    store.getState().closeGitLogPage()
    expect(store.getState().activeView).toBe('tasks')
  })
})

describe('the Stands page', () => {
  it('returns to where the user started, through the other build-web pages and Git', () => {
    const store = createUIStore()
    store.setState({ activeView: 'tasks' })
    store.getState().openBuildWebRecapsPage()
    store.getState().openBuildWebStandsPage()
    store.getState().closeBuildWebStandsPage()
    expect(store.getState().activeView).toBe('tasks')
    store.getState().openBuildWebStandsPage()
    store.getState().openGitLogPage()
    store.getState().closeGitLogPage()
    expect(store.getState().activeView).toBe('tasks')
  })
})
