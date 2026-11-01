import { describe, expect, it } from 'vitest'
import { BUILD_WEB_OPEN_STATUSES } from './build-web-types'
import { statusFilterServed, upgradeKeptStatuses } from './build-web-status-compat'

describe('statusFilterServed', () => {
  it('drops self-testing for a server that predates it', () => {
    expect(statusFilterServed(['todo', 'self_testing'], false)).toEqual(['todo'])
  })

  it('keeps the filter for a server that knows it', () => {
    expect(statusFilterServed(['todo', 'self_testing'], true)).toEqual(['todo', 'self_testing'])
  })

  it('refuses a filter that was only self-testing', () => {
    expect(statusFilterServed(['self_testing'], false)).toBeNull()
  })
})

describe('upgradeKeptStatuses', () => {
  it('brings a kept Open filter from before self-testing up to today', () => {
    const before = BUILD_WEB_OPEN_STATUSES.filter((s) => s !== 'self_testing')
    expect(upgradeKeptStatuses(before)).toEqual([...BUILD_WEB_OPEN_STATUSES])
  })

  it('leaves another choice as it was', () => {
    expect(upgradeKeptStatuses(['todo'])).toEqual(['todo'])
  })
})
