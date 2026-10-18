import { mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { customBuildEnvironment } from './build-custom.mjs'
import { fileNamesOf, readNewestManifests } from './publish-custom-build.mjs'

const require = createRequire(import.meta.url)
const { resolveCustomUpdateFeed } = require('./custom-update-feed.cjs')

const identity = { commit: 'abc123', version: '1.4.214-custom.1.abc123' }

describe('custom build environment', () => {
  it('points the feed and release page at build-web and signs macOS builds', () => {
    const env = customBuildEnvironment({ environment: {}, identity, platform: 'mac' })
    expect(env.ORCA_UPDATE_FEED_URL).toBe('https://tw.spitch-dev.ai:8585/orca-updates')
    expect(env.ORCA_UPDATE_RELEASE_NOTES_URL).toBe('https://tw.spitch-dev.ai:8585/orca')
    expect(env.ORCA_LOCAL_BUILD_VERSION).toBe(identity.version)
    expect(env.CSC_NAME).toBe('Orca Custom Builds')
  })

  it('follows BW_URL and leaves Linux unsigned', () => {
    const env = customBuildEnvironment({
      environment: { BW_URL: 'https://bw.example/' },
      identity,
      platform: 'linux'
    })
    expect(env.ORCA_UPDATE_FEED_URL).toBe('https://bw.example/orca-updates')
    expect(env.CSC_NAME).toBeUndefined()
  })

  it('stamps nothing for a release build and refuses a feed that is not https', () => {
    expect(resolveCustomUpdateFeed({})).toBeNull()
    expect(
      resolveCustomUpdateFeed({ ORCA_UPDATE_FEED_URL: 'https://bw.example/orca-updates/' })
    ).toEqual({
      url: 'https://bw.example/orca-updates',
      releaseNotesUrl: null
    })
    expect(() => resolveCustomUpdateFeed({ ORCA_UPDATE_FEED_URL: 'http://bw.example' })).toThrow(
      /https/
    )
  })
})

describe('publishing a custom build', () => {
  const dirs = []
  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  function dist(files) {
    const dir = mkdtempSync(join(tmpdir(), 'orca-dist-'))
    dirs.push(dir)
    for (const [name, text, mtime] of files) {
      writeFileSync(join(dir, name), text)
      if (mtime) {
        utimesSync(join(dir, name), mtime, mtime)
      }
    }
    return dir
  }

  it('takes the newest build and skips another platform left over from an older one', () => {
    const dir = dist([
      ['latest-linux.yml', 'version: 1.0.0-custom.1.aaa\nfiles: []\n', 1000],
      [
        'custom-mac.yml',
        'version: 1.0.0-custom.2.bbb\nfiles:\n  - url: Orca-mac.zip\n  - url: orca-macos-arm64.dmg\n',
        2000
      ],
      ['builder-debug.yml', 'x64: {}\n', 3000],
      ['Orca-mac.zip.blockmap', 'b']
    ])
    const { version, manifests } = readNewestManifests(dir)
    expect(version).toBe('1.0.0-custom.2.bbb')
    expect(Object.keys(manifests)).toEqual(['latest-mac.yml'])
    expect(fileNamesOf(manifests, dir)).toEqual([
      'Orca-mac.zip',
      'Orca-mac.zip.blockmap',
      'orca-macos-arm64.dmg'
    ])
  })

  it('says what to run when dist has no build', () => {
    expect(() => readNewestManifests(dist([]))).toThrow(/build:mac:custom/)
  })
})
