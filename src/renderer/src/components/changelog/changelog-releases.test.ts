import { describe, expect, it } from 'vitest'
import {
  changelogReleasesOf,
  isInstalledRelease,
  releaseBaseVersion,
  releaseDateLabel
} from './changelog-releases'

const RELEASE = {
  version: '1.4.230-custom.1792399999999',
  date: '2026-10-19',
  commit: 'eda1f0cd43ab',
  features: ['Sidebar → Recaps lists the finished automation reports.'],
  settings: [],
  fixes: ['Images shows a red count of images whose last build failed.']
}

describe('the changelog file', () => {
  it('reads the releases and drops what is not one', () => {
    const got = changelogReleasesOf({
      releases: [RELEASE, { version: '', date: '2026-10-18' }, 'nonsense', { date: 'x' }]
    })
    expect(got).toEqual([{ ...RELEASE, note: null }])
  })

  it('keeps only non-empty strings in a section, and a note when there is one', () => {
    const [got] = changelogReleasesOf({
      releases: [{ ...RELEASE, note: 'Everything this custom build adds to Orca', fixes: ['', 3] }]
    })
    expect(got.fixes).toEqual([])
    expect(got.note).toBe('Everything this custom build adds to Orca')
  })

  it('reads nothing out of a file that is not one', () => {
    expect(changelogReleasesOf(null)).toEqual([])
    expect(changelogReleasesOf({ releases: 'x' })).toEqual([])
  })
})

describe('a release', () => {
  const [release] = changelogReleasesOf({ releases: [RELEASE] })

  it('is installed when the app version is that release plus its commit', () => {
    expect(isInstalledRelease(release, '1.4.230-custom.1792399999999.0123456789ab')).toBe(true)
    expect(isInstalledRelease(release, '1.4.230-custom.17923999999990.0123456789ab')).toBe(false)
    expect(isInstalledRelease(release, null)).toBe(false)
  })

  it('names its base version and its day', () => {
    expect(releaseBaseVersion(release.version)).toBe('1.4.230')
    expect(releaseDateLabel('2026-10-19')).toBe(
      new Date(2026, 9, 19).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    )
    expect(releaseDateLabel('soon')).toBe('soon')
  })
})
