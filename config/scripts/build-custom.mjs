#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { getLocalBuildIdentity } from './build-mac-local.mjs'
import { resolveLinuxBuildArch, runLocalLinuxBuild } from './build-linux-local.mjs'

// A custom build updates from build-web's /orca-updates instead of the GitHub releases.
// Publish it afterwards with `pnpm publish:custom` (config/scripts/publish-custom-build.mjs).

export const DEFAULT_BUILD_WEB_URL = 'https://tw.spitch-dev.ai:8585'
// The self-signed code-signing certificate every custom macOS build is signed with.
export const DEFAULT_MAC_SIGNING_IDENTITY = 'Orca Custom Builds'

const STABLE_TAG_RE = /^v(\d+)\.(\d+)\.(\d+)$/

function versionParts(version) {
  return version.split('-')[0].split('.').map(Number)
}

function compareParts(a, b) {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2]
}

/**
 * One patch above the newest upstream release in `tags`, or the package version when that is newer.
 *
 * Why: main's package.json lags the releases, and a custom build that reads as older than the
 * release a host runs is refused as a downgrade (orcad-host-version-admission.ts, dpkg).
 */
export function customBaseVersion(packageVersion, tags) {
  const releases = tags
    .map((tag) => STABLE_TAG_RE.exec(tag))
    .filter(Boolean)
    .map((match) => [Number(match[1]), Number(match[2]), Number(match[3])])
  const newest = releases.reduce((a, b) => (a && compareParts(a, b) >= 0 ? a : b), null)
  const next = newest ? [newest[0], newest[1], newest[2] + 1] : null
  const own = versionParts(packageVersion)
  return (next && compareParts(next, own) > 0 ? next : own).join('.')
}

function readBaseVersion(environment) {
  if (environment.ORCA_CUSTOM_BASE_VERSION) {
    return environment.ORCA_CUSTOM_BASE_VERSION
  }
  const packageVersion = JSON.parse(readFileSync(resolve('package.json'), 'utf8')).version
  const tags = execFileSync('git', ['tag', '--list', 'v*'], { encoding: 'utf8' }).split('\n')
  return customBaseVersion(packageVersion, tags)
}

export function customBuildEnvironment({ environment = process.env, identity, platform }) {
  const buildWebUrl = (environment.BW_URL || DEFAULT_BUILD_WEB_URL).replace(/\/+$/, '')
  const env = {
    ...environment,
    ORCA_BUILD_COMMIT: identity.commit,
    ORCA_LOCAL_BUILD_VERSION: identity.version,
    ORCA_UPDATE_FEED_URL: environment.ORCA_UPDATE_FEED_URL || `${buildWebUrl}/orca-updates`,
    ORCA_UPDATE_RELEASE_NOTES_URL:
      environment.ORCA_UPDATE_RELEASE_NOTES_URL || `${buildWebUrl}/orca`,
    // Why: without the template a server's `orca-ide serve` falls back to Electron, and the desktop can't deploy orcad over SSH.
    ORCA_REQUIRE_ORCAD_TEMPLATE: '1'
  }
  if (platform === 'mac') {
    // Why: Squirrel.Mac installs only an update whose signature matches the running build's, and an ad-hoc signature never does.
    env.CSC_NAME = environment.CSC_NAME || DEFAULT_MAC_SIGNING_IDENTITY
  }
  return env
}

/** The prebuild slots the template can carry, and the one this build cannot ship without. */
export function orcadTemplateTargets(prebuildsDir, requiredSlot) {
  const manifest = join(prebuildsDir, 'manifest.json')
  const slots = existsSync(manifest)
    ? Object.keys(JSON.parse(readFileSync(manifest, 'utf8')).slots ?? {})
    : []
  if (!slots.includes(requiredSlot)) {
    throw new Error(
      `out/orcad-prebuilds has no ${requiredSlot} slot: run pnpm build:orcad-prebuilds on a ${requiredSlot} host and copy out/orcad-prebuilds here`
    )
  }
  return slots
}

export function runCustomBuild(
  platform,
  { environment = process.env, execFile = execFileSync } = {}
) {
  if (platform !== 'mac' && platform !== 'linux') {
    throw new Error(`Unsupported custom build platform: ${platform}. Use --mac or --linux.`)
  }
  const identity = getLocalBuildIdentity('custom', readBaseVersion(environment))
  const env = customBuildEnvironment({ environment, identity, platform })
  console.log(`[build:custom] ${platform} ${identity.version} → ${env.ORCA_UPDATE_FEED_URL}`)
  // The desktop deploys orcad to Linux servers; a server runs its own slot.
  const requiredSlot =
    platform === 'mac' ? 'linux-x64-glibc' : `linux-${resolveLinuxBuildArch()}-glibc`
  const targets = orcadTemplateTargets(resolve('out/orcad-prebuilds'), requiredSlot)
  env.ORCA_ORCAD_TEMPLATE_TARGETS = targets.join(',')
  execFile(
    process.execPath,
    ['config/scripts/build-orcad-template.mjs', '--targets', targets.join(',')],
    { env, stdio: 'inherit' }
  )
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
  } else {
    // Why no rpm: custom builds go to Ubuntu hosts; an AppImage and a deb cover them.
    runLocalLinuxBuild({ environment: env, execFile, targets: ['AppImage', 'deb'] })
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
