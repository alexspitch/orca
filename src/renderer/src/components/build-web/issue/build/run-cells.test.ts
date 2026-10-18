import { describe, expect, it } from 'vitest'
import type { BuildWebRunBuild } from '../../../../../../shared/build-web-run-types'
import {
  cellLabel,
  cellsOf,
  elapsedLabel,
  failedCells,
  imageLinks,
  mergeCells,
  productOfImage,
  staleCells,
  testsChoice,
  unpushedCells
} from './run-cells'

// After build-web's build-cells and bulk-actions tests: rows from the stored run, the two
// versions of one row reconciled, and what each bulk button takes from the ticked rows.

const KEY = 'dc/ib-script-engine|rhel|master'

function rec(status: string, extra: Partial<BuildWebRunBuild> = {}): BuildWebRunBuild {
  return {
    image: 'dc/ib-script-engine',
    dist: 'rhel',
    branch: 'master',
    status,
    number: null,
    url: null,
    tags: [],
    pushed: false,
    main_tag_pushed: false,
    main_tag_skipped: false,
    skipped_tags: [],
    started_at: null,
    tests_skipped: false,
    error: null,
    ...extra
  }
}

describe('rows from the stored run', () => {
  it('reads the in-flight statuses as live rows, not as results', () => {
    expect(cellsOf([rec('queued')])[KEY].state).toBe('queued')
    expect(cellsOf([rec('building')])[KEY]).toMatchObject({ state: 'building', status: null })
    expect(cellsOf([rec('pending')])[KEY].state).toBe('pending')
  })

  it('treats an unknown status as a result rather than dropping the row', () => {
    expect(cellsOf([rec('poll-failed')])[KEY]).toMatchObject({
      state: 'done',
      status: 'poll-failed'
    })
  })
})

describe('reconciling a fresh read with the rows on screen', () => {
  it('never walks a row backwards', () => {
    const shown = cellsOf([rec('building', { number: 7 })])
    const merged = mergeCells(shown, cellsOf([rec('queued')]))
    expect(merged[KEY]).toMatchObject({ state: 'building', number: 7 })
  })

  it('shows a rebuild of a finished row instead of its old result', () => {
    const shown = cellsOf([rec('SUCCESS', { number: 1 })])
    const merged = mergeCells(shown, cellsOf([rec('queued')]))
    expect(merged[KEY].state).toBe('queued')
  })

  it('keeps a row the read has never heard of', () => {
    expect(mergeCells(cellsOf([rec('pending')]), {})[KEY].state).toBe('pending')
  })
})

describe('the state chip', () => {
  const t0 = Date.parse('2026-08-11T10:00:00.000Z')
  const started = new Date(t0).toISOString()

  it('carries the age of a live row only', () => {
    const at = t0 + 3 * 60_000
    expect(cellLabel(cellsOf([rec('building', { number: 5, started_at: started })])[KEY], at)).toBe(
      'building #5 · 3m'
    )
    expect(cellLabel(cellsOf([rec('queued', { started_at: started })])[KEY], at)).toBe(
      'queued · 3m'
    )
    expect(cellLabel(cellsOf([rec('SUCCESS', { started_at: started })])[KEY], at)).toBe('SUCCESS')
  })

  it('says nothing rather than something wrong', () => {
    expect(elapsedLabel(null, t0)).toBeNull()
    expect(elapsedLabel('not a date', t0)).toBeNull()
    expect(elapsedLabel(started, t0 - 5000)).toBeNull()
    expect(elapsedLabel(started, t0 + 95 * 60_000)).toBe('1h 35m')
  })
})

describe('what each bulk button takes', () => {
  const rows = Object.values(
    cellsOf([
      rec('SUCCESS', { image: 'dc/a', tags: ['r/dc/a:1', 'r/dc/a:1b2'] }),
      rec('SUCCESS', { image: 'dc/b', tags: ['r/dc/b:1'], pushed: true }),
      rec('FAILURE', { image: 'dc/c' }),
      rec('building', { image: 'dc/d' })
    ])
  )
  const freshness = {
    'dc/a|rhel|master': {
      key: 'dc/a|rhel|master',
      state: 'stale' as const,
      built_at: null,
      built_from: null,
      ref_at: null,
      newer_unpublished: null
    }
  }

  it('splits one selection by the badge each row carries', () => {
    expect(staleCells(rows, freshness).map((c) => c.image)).toEqual(['dc/a'])
    expect(failedCells(rows).map((c) => c.image)).toEqual(['dc/c'])
    expect(unpushedCells(rows).map((c) => c.image)).toEqual(['dc/a'])
  })

  it('copies each reference once, in row order', () => {
    const picked = new Set(['dc/a|rhel|master', 'dc/b|rhel|master'])
    expect(imageLinks(rows, picked)).toEqual(['r/dc/a:1', 'r/dc/a:1b2', 'r/dc/b:1'])
  })
})

describe('tests on a build started by hand', () => {
  it('runs them when asked, and always when Jenkins builds one of the branches', () => {
    const tree = new Set(['master'])
    expect(testsChoice(['master'], tree, false)).toEqual({ forced: false, skipTests: true })
    expect(testsChoice(['master'], tree, true)).toEqual({ forced: false, skipTests: false })
    expect(testsChoice(['master', 'dc-release-3.1'], tree, false)).toEqual({
      forced: true,
      skipTests: false
    })
  })
})

it('groups images the way their release branches do', () => {
  expect(productOfImage('dc/ib-filestorage-service')).toBe('storage')
  expect(productOfImage('dc/ib-api-server')).toBe('dc')
  expect(productOfImage('common/x')).toBe('sa')
  expect(productOfImage('auth-portal/y')).toBe('ap')
  expect(productOfImage('misc/z')).toBe('other')
})
