import { describe, expect, it } from 'vitest'
import {
  showsBuildWebActivity,
  showsBuildWebRecaps,
  showsBuildWebStands,
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

describe('the Stands sidebar group', () => {
  it('follows Issues until it is set on its own', () => {
    expect(showsBuildWebStands({ showBuildWebButton: true })).toBe(true)
    expect(showsBuildWebStands(undefined)).toBe(false)
    expect(showsBuildWebStands({ showBuildWebButton: true, showBuildWebStandsButton: false })).toBe(
      false
    )
    expect(showsBuildWebStands({ showBuildWebButton: false, showBuildWebStandsButton: true })).toBe(
      true
    )
  })
})

describe('the titlebar bell and task counter', () => {
  it('follow Issues until they are set on their own', () => {
    expect(showsBuildWebActivity({ showBuildWebButton: true })).toBe(true)
    expect(showsBuildWebActivity(undefined)).toBe(false)
    expect(showsBuildWebActivity({ showBuildWebButton: true, showBuildWebActivity: false })).toBe(
      false
    )
    expect(showsBuildWebActivity({ showBuildWebButton: false, showBuildWebActivity: true })).toBe(
      true
    )
  })
})
