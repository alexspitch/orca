#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createReadStream, existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { Readable } from 'node:stream'
import { parse } from 'yaml'
import { DEFAULT_BUILD_WEB_URL } from './build-custom.mjs'

// Uploads the custom build in dist/ to build-web's «Orca» section, from where custom builds update.
// Needs a personal build-web API token: BW_TOKEN, or a file named by BW_TOKEN_FILE.

// Why any channel: electron-builder names a prerelease's manifests after it (custom-mac.yml), while
// the app's generic feed has no channel and asks for latest-*.yml — so build-web stores them as that.
const MANIFEST_FILE_RE = /^([a-z]+)(-mac|-linux|-linux-arm64)?\.yml$/
const UPLOAD_ATTEMPTS = 3

async function sha512File(path) {
  const hash = createHash('sha512')
  for await (const chunk of createReadStream(path)) {
    hash.update(chunk)
  }
  return hash.digest('base64')
}

/** The manifests of the newest build in distDir; older leftovers of other platforms are skipped. */
export function readNewestManifests(distDir) {
  const found = []
  for (const file of readdirSync(distDir)) {
    const match = MANIFEST_FILE_RE.exec(file)
    if (!match) {
      continue
    }
    const path = join(distDir, file)
    const manifest = parse(readFileSync(path, 'utf8'))
    if (!manifest?.version || !Array.isArray(manifest.files)) {
      continue
    }
    found.push({ name: `latest${match[2] ?? ''}.yml`, mtime: statSync(path).mtimeMs, manifest })
  }
  if (found.length === 0) {
    throw new Error(
      `No update manifest in ${distDir}: run pnpm build:mac:custom or pnpm build:linux:custom first`
    )
  }
  const newest = found.reduce((a, b) => (b.mtime > a.mtime ? b : a))
  const version = String(newest.manifest.version)
  const manifests = {}
  for (const { name, manifest } of found) {
    if (String(manifest.version) === version) {
      manifests[name] = manifest
    } else {
      console.warn(`[publish:custom] skipping ${name}: it is ${manifest.version}, not ${version}`)
    }
  }
  return { version, manifests }
}

/** The files a build-web build declares: every manifest entry and the blockmap beside it. */
export function fileNamesOf(manifests, distDir) {
  const names = new Set()
  for (const manifest of Object.values(manifests)) {
    for (const file of manifest.files ?? []) {
      names.add(file.url)
      if (existsSync(join(distDir, `${file.url}.blockmap`))) {
        names.add(`${file.url}.blockmap`)
      }
    }
  }
  return [...names]
}

function git(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
}

async function call(baseUrl, token, method, path, { json, body } = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': json === undefined ? 'application/octet-stream' : 'application/json'
    },
    body: json === undefined ? body : JSON.stringify(json),
    ...(body ? { duplex: 'half' } : {})
  })
  const text = await res.text()
  let data = {}
  try {
    data = JSON.parse(text)
  } catch {
    data = { error: text.slice(0, 300) }
  }
  if (!res.ok) {
    throw new Error(`${method} ${path}: ${res.status} ${data.error ?? ''}`.trim())
  }
  return data
}

function readToken(environment) {
  if (environment.BW_TOKEN?.trim()) {
    return environment.BW_TOKEN.trim()
  }
  if (environment.BW_TOKEN_FILE) {
    return readFileSync(environment.BW_TOKEN_FILE, 'utf8').trim()
  }
  throw new Error(
    'Set BW_TOKEN (or BW_TOKEN_FILE) to a build-web API token: build-web → key icon in the header → issue a token.'
  )
}

export async function publishCustomBuild({
  distDir = resolve('dist'),
  environment = process.env,
  notes
} = {}) {
  const baseUrl = (environment.BW_URL || DEFAULT_BUILD_WEB_URL).replace(/\/+$/, '')
  const token = readToken(environment)
  const { version, manifests } = readNewestManifests(distDir)
  const files = []
  for (const name of fileNamesOf(manifests, distDir)) {
    const path = join(distDir, name)
    if (!existsSync(path)) {
      throw new Error(`${name} is named in a manifest but missing from ${distDir}`)
    }
    files.push({ name, size: statSync(path).size, sha512: await sha512File(path) })
  }
  // The build's own commit is in its version (custom.<time>.<commit>); HEAD may have moved since.
  const commit = /[-.]custom\.\d+\.([0-9a-f]+)$/.exec(version)?.[1] ?? git(['rev-parse', 'HEAD'])
  const draft = {
    version,
    commit,
    branch: git(['branch', '--show-current']),
    notes: notes ?? git(['log', '-1', '--format=%s', commit || 'HEAD']),
    manifests,
    files
  }
  console.log(`[publish:custom] ${version}: ${Object.keys(manifests).join(', ')} → ${baseUrl}`)
  const { build } = await call(baseUrl, token, 'POST', '/api/orca-builds', { json: draft })
  for (const file of files) {
    const mb = Math.round(file.size / 1024 / 1024)
    for (let attempt = 1; ; attempt++) {
      try {
        await call(
          baseUrl,
          token,
          'PUT',
          `/api/orca-builds/${build.id}/files/${encodeURIComponent(file.name)}`,
          { body: Readable.toWeb(createReadStream(join(distDir, file.name))) }
        )
        console.log(`[publish:custom]   ${file.name} (${mb} MB)`)
        break
      } catch (error) {
        if (attempt >= UPLOAD_ATTEMPTS) {
          throw error
        }
        console.warn(`[publish:custom]   ${file.name}: ${error.message}; retrying`)
      }
    }
  }
  await call(baseUrl, token, 'POST', `/api/orca-builds/${build.id}/publish`)
  console.log(`[publish:custom] published ${version}: ${baseUrl}/orca`)
  return build
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const notesAt = process.argv.indexOf('--notes')
  publishCustomBuild({ notes: notesAt > 0 ? process.argv[notesAt + 1] : undefined }).catch(
    (error) => {
      console.error(`[publish:custom] ${error.message}`)
      process.exitCode = 1
    }
  )
}
