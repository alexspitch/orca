import { describe, expect, it } from 'vitest'
import { showsBuildWebTesting, showsBuildWebTrains } from './sidebar-button-settings'

describe('the Trains sidebar item', () => {
  it('follows Issues until it is set on its own', () => {
    expect(showsBuildWebTrains({ showBuildWebButton: true })).toBe(true)
    expect(showsBuildWebTrains({ showBuildWebButton: false })).toBe(false)
    expect(showsBuildWebTrains(null)).toBe(false)
    expect(showsBuildWebTrains({ showBuildWebButton: true, showBuildWebTrainsButton: false })).toBe(
      false
    )
    expect(showsBuildWebTrains({ showBuildWebButton: false, showBuildWebTrainsButton: true })).toBe(
      true
    )
  })
})

describe('the Testing sidebar item', () => {
  it('follows Issues until it is set on its own', () => {
    expect(showsBuildWebTesting({ showBuildWebButton: true })).toBe(true)
    expect(showsBuildWebTesting({ showBuildWebButton: false })).toBe(false)
    expect(showsBuildWebTesting(undefined)).toBe(false)
    expect(
      showsBuildWebTesting({ showBuildWebButton: true, showBuildWebTestingButton: false })
    ).toBe(false)
    expect(
      showsBuildWebTesting({ showBuildWebButton: false, showBuildWebTestingButton: true })
    ).toBe(true)
  })
})
