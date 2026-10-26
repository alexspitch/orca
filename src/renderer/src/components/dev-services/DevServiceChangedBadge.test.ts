import { describe, expect, it } from 'vitest'
import { devServiceChangedSummary } from './DevServiceChangedBadge'
import { buildFailureLines } from './use-dev-services-actions'

describe('the changed-code badge', () => {
  it('says since when, the workspaces, what is not built, and the first files', () => {
    const files = ['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts', 'f.ts', 'g.ts']
    expect(
      devServiceChangedSummary(
        { since: 1000, files, workspaces: ['@sp/api'], unbuilt: ['@sp/ui'] },
        1_120_000
      ).split('\n')
    ).toEqual([
      'Code on disk is newer than the running service (2 min)',
      'Workspaces: @sp/api',
      'Not built: @sp/ui',
      'Files: a.ts, b.ts, c.ts, d.ts, e.ts +2 more'
    ])
  })

  it('leaves out what is empty', () => {
    expect(devServiceChangedSummary({ files: [], workspaces: [], unbuilt: [] })).toBe(
      'Code on disk is newer than the running service'
    )
  })
})

describe('a failed rebuild', () => {
  it('shows the last thing each target printed', () => {
    expect(
      buildFailureLines([
        { target: '@sp/api', output: 'building…\nsrc/x.ts: error TS2322\n\n' },
        { target: '@sp/ui', output: '' }
      ])
    ).toEqual(['@sp/api: src/x.ts: error TS2322', '@sp/ui'])
  })
})
