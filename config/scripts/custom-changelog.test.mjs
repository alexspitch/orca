import { describe, expect, it } from 'vitest'
import {
  BASELINE_NOTE,
  formatChangelog,
  parseCommits,
  prependRelease,
  promptInput,
  rangeStartOf,
  readChangelog,
  sectionsOf
} from './custom-changelog.mjs'

const RELEASE = {
  version: '1.4.230-custom.1792399999999',
  date: '2026-10-19',
  commit: 'eda1f0cd43ab',
  features: ['Sidebar → Recaps lists the finished automation reports.'],
  settings: [],
  fixes: []
}

describe('the range of a release', () => {
  it('starts at the last release, or at upstream the first time', () => {
    expect(rangeStartOf({ releases: [RELEASE] })).toEqual({ from: 'eda1f0cd43ab', baseline: false })
    expect(rangeStartOf({ releases: [] })).toEqual({ from: 'upstream/main', baseline: true })
  })

  it('refuses a file without a release list', () => {
    expect(() => readChangelog('{"x":1}')).toThrow(/releases/)
    expect(readChangelog('{"releases":[]}')).toEqual({ releases: [] })
  })
})

describe('the commits', () => {
  const log =
    'aaa\x1ffeat(x): a «Recaps» page\x1fA page.\n\nMore.\x1e\n' +
    'bbb\x1fchore(changelog): 1.4.230-custom.1\x1f\x1e\n' +
    'ccc\x1ffix(y): the chip counts right\x1f\x1e\n'

  it('reads subject and body, leaving out the changelog’s own commits', () => {
    expect(parseCommits(log)).toEqual([
      { sha: 'aaa', subject: 'feat(x): a «Recaps» page', body: 'A page.\n\nMore.' },
      { sha: 'ccc', subject: 'fix(y): the chip counts right', body: '' }
    ])
  })

  it('shrinks bodies to their first paragraph, then drops them, to fit the prompt', () => {
    const commits = parseCommits(log)
    expect(promptInput(commits)).toContain('More.')
    const short = promptInput(commits, 75)
    expect(short).toContain('A page.')
    expect(short).not.toContain('More.')
    expect(promptInput(commits, 70)).not.toContain('A page.')
  })
})

describe('the model’s answer', () => {
  it('takes the JSON object out of it, trimmed and without empty items', () => {
    expect(
      sectionsOf('Here:\n```json\n{"features":[" A page. ",""],"fixes":["A fix."]}\n```')
    ).toEqual({ features: ['A page.'], settings: [], fixes: ['A fix.'] })
  })

  it('refuses what is not the three lists of sentences', () => {
    expect(() => sectionsOf('no json')).toThrow(/no JSON/)
    expect(() => sectionsOf('{"features":"one"}')).toThrow(/features/)
    expect(() => sectionsOf(`{"fixes":["${'x'.repeat(401)}"]}`)).toThrow(/longer/)
  })
})

describe('the file', () => {
  it('puts the new release on top and keeps the rest', () => {
    const next = prependRelease(
      { releases: [RELEASE] },
      { ...RELEASE, version: 'v2', note: BASELINE_NOTE }
    )
    expect(next.releases.map((r) => r.version)).toEqual(['v2', RELEASE.version])
    expect(formatChangelog(next).endsWith('}\n')).toBe(true)
  })
})
