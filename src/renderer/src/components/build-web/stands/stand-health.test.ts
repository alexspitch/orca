import { describe, expect, it } from 'vitest'
import type { BuildWebStandHealth } from '../../../../../shared/build-web-stand-types'
import { standHealthTotals } from './stand-health'

const health = (over: Partial<BuildWebStandHealth>): BuildWebStandHealth => ({
  running: true,
  failing: 0,
  outdated: 0,
  updates: [],
  error: null,
  ...over
})

describe('the sidebar totals', () => {
  it('counts the stands over one directory once', () => {
    const update = { service: 's', image: 'x:1', running: '1b1', newer: '1b2' }
    const totals = standHealthTotals({
      ap: health({
        instance: 'h:/box',
        name: 'AP 1.16',
        failing: 1,
        outdated: 1,
        updates: [update]
      }),
      sa: health({
        instance: 'h:/box',
        name: 'SA 2.15',
        failing: 1,
        outdated: 1,
        updates: [update]
      }),
      dc: health({ instance: 'h:/dc', name: 'DC', failing: 2 }),
      off: health({ instance: 'h:/off', running: false })
    })
    expect(totals.failing).toBe(3)
    expect(totals.outdated).toBe(1)
    expect(totals.updates).toEqual([
      { instance: 'h:/box', stands: 'AP 1.16 · SA 2.15', updates: [update] }
    ])
  })
})
