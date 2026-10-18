import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  CUSTOM_UPDATE_FEED_FILENAME,
  parseCustomUpdateFeed,
  readCustomUpdateFeed
} from './custom-update-feed'

describe('custom update feed stamp', () => {
  const dirs: string[] = []
  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('reads the feed and release page a custom build was packaged with', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'orca-feed-'))
    dirs.push(dir)
    writeFileSync(
      path.join(dir, CUSTOM_UPDATE_FEED_FILENAME),
      JSON.stringify({
        url: 'https://tw.spitch-dev.ai:8585/orca-updates',
        releaseNotesUrl: 'https://tw.spitch-dev.ai:8585/orca'
      })
    )
    expect(readCustomUpdateFeed(dir)).toEqual({
      url: 'https://tw.spitch-dev.ai:8585/orca-updates',
      releaseNotesUrl: 'https://tw.spitch-dev.ai:8585/orca'
    })
  })

  it('treats a build without the stamp as an upstream build', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'orca-feed-'))
    dirs.push(dir)
    expect(readCustomUpdateFeed(dir)).toBeNull()
    expect(readCustomUpdateFeed(undefined)).toBeNull()
  })

  it('refuses a feed that is not plain https', () => {
    expect(parseCustomUpdateFeed('{"url":"http://example.com/feed"}')).toBeNull()
    expect(parseCustomUpdateFeed('{"url":"https://user:pw@example.com/feed"}')).toBeNull()
    expect(parseCustomUpdateFeed('not json')).toBeNull()
    expect(parseCustomUpdateFeed('{"url":"https://example.com/feed","releaseNotesUrl":1}')).toEqual(
      { url: 'https://example.com/feed', releaseNotesUrl: null }
    )
  })
})
