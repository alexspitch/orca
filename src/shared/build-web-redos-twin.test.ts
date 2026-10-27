import { describe, expect, it } from 'vitest'
import { twinChipOf, twinOf, withoutTwins, type TwinChipRow } from './build-web-redos-twin'

// After build-web's Progress: the chip each redos twin and each rhel row without one shows.

const row = (patch: Partial<TwinChipRow>): TwinChipRow => ({
  twin: 'derive',
  dist: 'redos',
  state: 'done',
  status: 'SUCCESS',
  note: null,
  ...patch
})

describe('redos twins', () => {
  it('reads only the two kinds the console writes', () => {
    expect(twinOf('derive')).toBe('derive')
    expect(twinOf('full')).toBe('full')
    expect(twinOf('other')).toBeNull()
    expect(twinOf(undefined)).toBeNull()
  })

  it('leaves the twins out of the rows that count', () => {
    expect(withoutTwins([{ twin: null }, { twin: 'derive' }, { twin: 'full' }])).toEqual([
      { twin: null }
    ])
  })

  it('names a twin going by how it is made', () => {
    expect(twinChipOf(row({ state: 'building', status: null }))).toEqual({ kind: 'deriving' })
    expect(twinChipOf(row({ twin: 'full', state: 'queued', status: null }))).toEqual({
      kind: 'full-building'
    })
  })

  it('says why a twin waits for a person, and why one failed, with the console’s words', () => {
    const why = 'ветка dc-release-3.0 ушла вперёд от сборки rhel #12093'
    expect(twinChipOf(row({ twin: 'full', state: 'pending', status: null, note: why }))).toEqual({
      kind: 'waiting',
      tip: why
    })
    expect(twinChipOf(row({ status: 'FAILURE', note: 'derive failed' }))).toEqual({
      kind: 'failed',
      tip: 'derive failed'
    })
    expect(twinChipOf(row({ status: 'FAILURE' }))).toEqual({ kind: 'failed', tip: 'FAILURE' })
  })

  it('shows nothing for a twin that went out, and «no redos» on a rhel row with a note', () => {
    expect(twinChipOf(row({}))).toBeNull()
    expect(twinChipOf(row({ twin: null, dist: 'rhel', note: 'ветка не собирает redos' }))).toEqual({
      kind: 'no-redos',
      tip: 'ветка не собирает redos'
    })
    expect(twinChipOf(row({ twin: null, dist: 'rhel' }))).toBeNull()
  })
})

it('takes a row from an older runtime, which has no `twin` key, for an ordinary row', () => {
  const rows: { twin?: 'derive' | null }[] = [{}, { twin: 'derive' }]
  expect(withoutTwins(rows)).toEqual([{}])
})
