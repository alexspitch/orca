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
