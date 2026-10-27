#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { stringify } from 'yaml'
import { publishCustomBuild, sha512File } from './publish-custom-build.mjs'

// Uploads a phone APK to build-web's «Orca» section beside the desktop builds, under its own
// `latest-android.yml`: no updater reads that manifest, so the build is only listed and downloaded.
//
//   BW_TOKEN=bwt_… pnpm publish:custom:android <path/to/app-release.apk> [--notes <text>]

const DEFAULT_APK = 'mobile/android/app/build/outputs/apk/release/app-release.apk'

/** The phone's own version, made unique per upload the way the desktop's custom builds are. */
export function androidBuildVersion(appVersion, stamp, commit) {
  return `${appVersion}-custom.${stamp}.${commit.slice(0, 12)}`
}

export async function publishCustomAndroid({ apk, environment = process.env, notes } = {}) {
  const source = resolve(apk ?? DEFAULT_APK)
  if (!existsSync(source)) {
    throw new Error(
      `No APK at ${source}: build it first (expo prebuild, then gradlew assembleRelease)`
    )
  }
  const appVersion = JSON.parse(readFileSync(resolve('mobile/app.json'), 'utf8')).expo.version
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  const version = androidBuildVersion(appVersion, Date.now(), commit)
  const name = `orca-mobile-${version}.apk`
  const distDir = mkdtempSync(join(tmpdir(), 'orca-android-publish-'))
  try {
    copyFileSync(source, join(distDir, name))
    const file = {
      url: name,
      sha512: await sha512File(join(distDir, name)),
      size: statSync(source).size
    }
    const manifest = {
      version,
      files: [file],
      path: name,
      sha512: file.sha512,
      releaseDate: new Date().toISOString()
    }
    writeFileSync(join(distDir, 'latest-android.yml'), stringify(manifest))
    return await publishCustomBuild({ distDir, environment, notes })
  } finally {
    rmSync(distDir, { recursive: true, force: true })
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const args = process.argv.slice(2)
  const notesAt = args.indexOf('--notes')
  const notes = notesAt === -1 ? undefined : args[notesAt + 1]
  const apk = args.find(
    (arg, at) => !arg.startsWith('--') && (notesAt === -1 || at !== notesAt + 1)
  )
  publishCustomAndroid({ apk, notes }).catch((error) => {
    console.error(`[publish:custom:android] ${error.message}`)
    process.exitCode = 1
  })
}
