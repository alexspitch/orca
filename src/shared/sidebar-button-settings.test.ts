import { describe, expect, it } from 'vitest'
import {
  showsBuildWebRecaps,
  showsBuildWebTesting,
  showsBuildWebTrains
} from './sidebar-button-settings'

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

describe('the Recaps sidebar item', () => {
  it('follows Issues until it is set on its own', () => {
    expect(showsBuildWebRecaps({ showBuildWebButton: true })).toBe(true)
    expect(showsBuildWebRecaps({ showBuildWebButton: false })).toBe(false)
    expect(showsBuildWebRecaps(undefined)).toBe(false)
    expect(showsBuildWebRecaps({ showBuildWebButton: true, showBuildWebRecapsButton: false })).toBe(
      false
    )
    expect(showsBuildWebRecaps({ showBuildWebButton: false, showBuildWebRecapsButton: true })).toBe(
      true
    )
  })
})
