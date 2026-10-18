import { readFileSync } from 'node:fs'
import path from 'node:path'

/** Where a custom build updates from instead of the stablyai/orca GitHub releases. */
export type CustomUpdateFeed = {
  /** electron-updater generic-provider base URL: `<url>/latest-mac.yml` and the files beside it. */
  url: string
  releaseNotesUrl: string | null
}

// Written by afterPack in config/electron-builder.config.cjs when ORCA_UPDATE_FEED_URL is set.
export const CUSTOM_UPDATE_FEED_FILENAME = 'update-feed.json'

// Why: `undefined` means "not read yet"; the stamp is part of the packaged app and never changes.
let cachedFeed: CustomUpdateFeed | null | undefined

function httpsUrl(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password ? url.toString() : null
  } catch {
    return null
  }
}

export function parseCustomUpdateFeed(raw: string): CustomUpdateFeed | null {
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof value !== 'object' || value === null) {
    return null
  }
  const record: Record<string, unknown> = { ...value }
  const url = httpsUrl(record.url)
  return url ? { url, releaseNotesUrl: httpsUrl(record.releaseNotesUrl) } : null
}

export function readCustomUpdateFeed(resourcesPath: string | undefined): CustomUpdateFeed | null {
  if (!resourcesPath) {
    return null
  }
  let raw: string
  try {
    raw = readFileSync(path.join(resourcesPath, CUSTOM_UPDATE_FEED_FILENAME), 'utf8')
  } catch {
    return null
  }
  const feed = parseCustomUpdateFeed(raw)
  if (!feed) {
    console.warn(`[updater] ${CUSTOM_UPDATE_FEED_FILENAME} is unusable; using the release feed`)
  }
  return feed
}

/** The feed this build was packaged with, or null for an upstream build. */
export function getCustomUpdateFeed(): CustomUpdateFeed | null {
  if (cachedFeed === undefined) {
    cachedFeed = readCustomUpdateFeed(process.resourcesPath)
  }
  return cachedFeed
}
