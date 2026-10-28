import { describe, expect, it } from 'vitest'
import { isPushable } from './build-web-image-push'
import { progressNews, twinPushOf } from './build-web-image-tracking'
import type { BuildWebImageBuild, BuildWebPushProgress } from './build-web-image-types'
import { imageTwinCellOf, withPairs } from './build-web-image-twins'

const build = (over: Partial<BuildWebImageBuild>): BuildWebImageBuild => ({
  image: 'dc/dc-backend',
  dist: 'rhel',
  branch: 'master',
  number: 41,
  status: 'success',
  raw_status: 'SUCCESS',
  ref: 'r/dc/dc-backend:3.6b41',
  tag: '3.6b41',
  version: '3.6',
  product: 'dc',
  product_version: '3.6',
  at: null,
  pushed_build_tag: true,
  pushed_main_tag: false,
  main_tag_on: null,
  run_id: 'run-1',
  url: null,
  twin: null,
  ...over
})

describe('redos twins in the image catalog (IS-230.23)', () => {
  const rhel = build({})
  const twin = build({
    dist: 'redos',
    twin: 'derive',
    twin_of: 41,
    ref: 'r/dc/dc-backend:3.6b41-redos',
    pushed_build_tag: false
  })
  const older = build({ number: 40, ref: 'r/dc/dc-backend:3.6b40' })
  const catalog = [twin, rhel, older]

  it('pairs a rhel build with its twin and back, by the number the twin was made for', () => {
    expect(imageTwinCellOf(withPairs(catalog, rhel))).toMatchObject({
      kind: 'twin',
      state: 'built',
      full: false,
      ref: 'r/dc/dc-backend:3.6b41-redos'
    })
    expect(imageTwinCellOf(withPairs(catalog, twin))).toEqual({
      kind: 'source',
      full: false,
      of: 41,
      ref: 'r/dc/dc-backend:3.6b41'
    })
    expect(withPairs(catalog, older).pair).toBeUndefined()
  })

  it('pairs a derived twin from a host without twin_of by its own number', () => {
    const bare = { ...twin, twin_of: null }
    expect(withPairs([bare, rhel], rhel).pair).toMatchObject({ dist: 'redos', twin: 'derive' })
  })

  it('never offers a twin for a push of its own', () => {
    expect(isPushable(build({ pushed_build_tag: false }))).toBe(true)
    expect(isPushable(twin)).toBe(false)
  })
})

describe('a push followed on for its twins (IS-230.23)', () => {
  const progress = (redos: Partial<NonNullable<BuildWebPushProgress['redos']>> | null) => ({
    runId: 'run-1',
    state: 'done' as const,
    lines: [],
    ok: ['dc/a|rhel', 'dc/b|rhel'],
    failed: [],
    error: null,
    redos: redos && { state: 'going' as const, derived: [], pushed: [], failed: [], ...redos }
  })

  it('says a twin goes only once the console is heard making twins', () => {
    expect(twinPushOf(progress({ state: 'waiting' }), 'dc/a|rhel')).toBeNull()
    expect(twinPushOf(progress({ derived: ['dc/a'] }), 'dc/a|rhel')).toBe('going')
    expect(twinPushOf(progress({ pushed: ['dc/a'], state: 'done' }), 'dc/a|rhel')).toBe('pushed')
    expect(twinPushOf(progress({ failed: ['dc/b'], state: 'done' }), 'dc/b|rhel')).toBe('failed')
    expect(twinPushOf(progress({ state: 'done' }), 'dc/a|rhel')).toBeNull()
  })

  it('tells the end of a push and of its twins once each', () => {
    const going = progress({ state: 'going' })
    expect(progressNews({}, [going]).pushEnded).toHaveLength(1)
    expect(progressNews({ 'run-1': going }, [going])).toEqual({ pushEnded: [], twinsEnded: [] })
    const done = progress({ state: 'done' })
    expect(progressNews({ 'run-1': going }, [done]).twinsEnded).toHaveLength(1)
    expect(progressNews({ 'run-1': done }, [done]).twinsEnded).toHaveLength(0)
  })
})
