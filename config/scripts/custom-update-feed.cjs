const { writeFileSync } = require('node:fs')
const { join } = require('node:path')

// Keep in step with CUSTOM_UPDATE_FEED_FILENAME in src/main/updater/custom-update-feed.ts.
const CUSTOM_UPDATE_FEED_FILENAME = 'update-feed.json'

function httpsUrl(name, value) {
  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error(`${name} is not a URL: ${value}`)
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error(`${name} must be an https URL without credentials: ${value}`)
  }
  return url.toString().replace(/\/+$/, '')
}

/** The feed a custom build updates from (ORCA_UPDATE_FEED_URL), or null for a GitHub release build. */
function resolveCustomUpdateFeed(env = process.env) {
  const feedUrl = env.ORCA_UPDATE_FEED_URL?.trim()
  if (!feedUrl) {
    return null
  }
  const notesUrl = env.ORCA_UPDATE_RELEASE_NOTES_URL?.trim()
  return {
    url: httpsUrl('ORCA_UPDATE_FEED_URL', feedUrl),
    releaseNotesUrl: notesUrl ? httpsUrl('ORCA_UPDATE_RELEASE_NOTES_URL', notesUrl) : null
  }
}

function writeCustomUpdateFeed(resourcesDir, feed) {
  writeFileSync(
    join(resourcesDir, CUSTOM_UPDATE_FEED_FILENAME),
    `${JSON.stringify(feed, null, 2)}\n`,
    'utf8'
  )
}

module.exports = {
  CUSTOM_UPDATE_FEED_FILENAME,
  resolveCustomUpdateFeed,
  writeCustomUpdateFeed
}
