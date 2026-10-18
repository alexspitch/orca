#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { getLocalBuildIdentity } from './build-mac-local.mjs'
import { runLocalLinuxBuild } from './build-linux-local.mjs'

// A custom build updates from build-web's /orca-updates instead of the GitHub releases.
// Publish it afterwards with `pnpm publish:custom` (config/scripts/publish-custom-build.mjs).

export const DEFAULT_BUILD_WEB_URL = 'https://tw.spitch-dev.ai:8585'
// The self-signed code-signing certificate every custom macOS build is signed with.
export const DEFAULT_MAC_SIGNING_IDENTITY = 'Orca Custom Builds'

export function customBuildEnvironment({ environment = process.env, identity, platform }) {
  const buildWebUrl = (environment.BW_URL || DEFAULT_BUILD_WEB_URL).replace(/\/+$/, '')
  const env = {
    ...environment,
    ORCA_BUILD_COMMIT: identity.commit,
    ORCA_LOCAL_BUILD_VERSION: identity.version,
    ORCA_UPDATE_FEED_URL: environment.ORCA_UPDATE_FEED_URL || `${buildWebUrl}/orca-updates`,
    ORCA_UPDATE_RELEASE_NOTES_URL:
      environment.ORCA_UPDATE_RELEASE_NOTES_URL || `${buildWebUrl}/orca`
  }
  if (platform === 'mac') {
    // Why: Squirrel.Mac installs only an update whose signature matches the running build's, and an ad-hoc signature never does.
    env.CSC_NAME = environment.CSC_NAME || DEFAULT_MAC_SIGNING_IDENTITY
  }
  return env
}

export function runCustomBuild(
  platform,
  { environment = process.env, execFile = execFileSync } = {}
) {
  const identity = getLocalBuildIdentity('custom')
  const env = customBuildEnvironment({ environment, identity, platform })
  console.log(`[build:custom] ${platform} ${identity.version} → ${env.ORCA_UPDATE_FEED_URL}`)
  if (platform === 'mac') {
    execFile(
      process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
      [
        'exec',
        'electron-builder',
        '--config',
        'config/electron-builder.config.cjs',
        '--mac',
        'dmg',
        'zip',
        '--arm64'
      ],
      { env, stdio: 'inherit' }
    )
  } else if (platform === 'linux') {
    // Why no rpm: custom builds go to Ubuntu hosts; an AppImage and a deb cover them.
    runLocalLinuxBuild({ environment: env, execFile, targets: ['AppImage', 'deb'] })
  } else {
    throw new Error(`Unsupported custom build platform: ${platform}. Use --mac or --linux.`)
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const platform = process.argv.includes('--linux')
    ? 'linux'
    : process.argv.includes('--mac')
      ? 'mac'
      : ''
  runCustomBuild(platform)
}
