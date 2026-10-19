#!/usr/bin/env node

import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

// The custom builds' changelog. orca-release runs this before it builds: the commits since the last
// release (or, the first time, everything the fork adds over upstream) go to `claude -p`, which
// writes what a user of the app would notice; the entry is put on top of the file and committed.
//
//   custom-changelog.mjs --check                 the range and the commit count; writes nothing
//   custom-changelog.mjs --dry-run [--version v] the entry it would write
//   custom-changelog.mjs --version <v>           write the entry and commit the file

export const CHANGELOG_PATH = 'src/renderer/src/components/changelog/custom-changelog.json'
export const BASELINE_NOTE = 'Everything this custom build adds to Orca'
const CHANGELOG_COMMIT_RE = /^chore\(changelog\):/
const SECTIONS = ['features', 'settings', 'fixes']
// Why caps: an item is one sentence, and the prompt must stay well inside one model call.
const ITEM_MAX_CHARS = 400
const BODY_MAX_CHARS = 1500
const PROMPT_MAX_CHARS = 150_000

export const CHANGELOG_PROMPT = `You write the changelog of a desktop app, Orca (a workspace for running coding agents
in git worktrees, here in a custom build with build-web pages: Issues, Images, Trains, Testing,
Recaps). Its users are the people who use the app, not its developers.

On stdin are the commit messages that went into this release. Write what a user would notice:
- "features": new features, pages, menu items, commands or behaviour a user can see or use;
- "settings": settings that are new, changed or removed;
- "fixes": bugs a user could have hit that are now fixed.

Rules:
- Leave out what a user never sees: refactors, code moves, tests, CI, build/release/packaging
  scripts, internal docs, dependency bumps, logging, performance work nobody would notice.
- One plain English sentence per item, present tense, at most about 25 words. Say where in the
  app it is (for example "Sidebar → Recaps" or "Settings → Integrations").
- Merge commits that make up one change into one item. No duplicates across sections.
- Never mention commit hashes, PR or issue numbers, file names, code identifiers or authors.
- Empty arrays are fine when nothing user-visible changed.

Answer with only this JSON object and nothing else:
{"features": ["..."], "settings": ["..."], "fixes": ["..."]}`

export function readChangelog(text) {
  const data = JSON.parse(text)
  if (!data || typeof data !== 'object' || !Array.isArray(data.releases)) {
    throw new Error(`${CHANGELOG_PATH} has no "releases" list`)
  }
  return data
}

/** Where this release's commits start: the last release's commit, or the fork point the first time. */
export function rangeStartOf(changelog) {
  const newest = changelog.releases[0]
  return newest && typeof newest.commit === 'string' && newest.commit
    ? { from: newest.commit, baseline: false }
    : { from: 'upstream/main', baseline: true }
}

/** `git log --format=%H%x1f%s%x1f%b%x1e` output, without the changelog's own commits. */
export function parseCommits(log) {
  return log
    .split('\x1e')
    .map((record) => record.replace(/^\n+/, ''))
    .filter(Boolean)
    .map((record) => {
      const [sha, subject, body = ''] = record.split('\x1f')
      return { sha: sha.trim(), subject: subject.trim(), body: body.trim() }
    })
    .filter((c) => c.sha && c.subject && !CHANGELOG_COMMIT_RE.test(c.subject))
}

/** The commits as the model reads them; bodies shrink to their first paragraph, then go, to fit. */
export function promptInput(commits, maxChars = PROMPT_MAX_CHARS) {
  const render = (body) => commits.map((c) => `### ${c.subject}\n${body(c)}`.trim()).join('\n\n')
  const full = render((c) => c.body.slice(0, BODY_MAX_CHARS))
  if (full.length <= maxChars) {
    return full
  }
  const short = render((c) => c.body.split(/\n\s*\n/)[0] ?? '')
  return short.length <= maxChars ? short : render(() => '').slice(0, maxChars)
}

/** The sections out of the model's answer, or an error saying what is wrong with it. */
export function sectionsOf(answer) {
  const start = answer.indexOf('{')
  const end = answer.lastIndexOf('}')
  if (start === -1 || end < start) {
    throw new Error('the answer has no JSON object')
  }
  const data = JSON.parse(answer.slice(start, end + 1))
  const out = {}
  for (const key of SECTIONS) {
    const items = data?.[key] ?? []
    if (!Array.isArray(items) || items.some((i) => typeof i !== 'string')) {
      throw new Error(`"${key}" is not a list of strings`)
    }
    const kept = items.map((i) => i.trim()).filter(Boolean)
    if (kept.some((i) => i.length > ITEM_MAX_CHARS)) {
      throw new Error(`an item of "${key}" is longer than ${ITEM_MAX_CHARS} characters`)
    }
    out[key] = kept
  }
  return out
}

export function prependRelease(changelog, release) {
  return { ...changelog, releases: [release, ...changelog.releases] }
}

export const formatChangelog = (changelog) => `${JSON.stringify(changelog, null, 2)}\n`

const localDate = (now = new Date()) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

function git(args, options = {}) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...options })
}

function commitsSince(from) {
  return parseCommits(git(['log', '--no-merges', '--format=%H%x1f%s%x1f%b%x1e', `${from}..HEAD`]))
}

function askClaude(input) {
  // Why a temp dir and no settings: the model gets only the commits, not this repo's CLAUDE.md or hooks.
  const cwd = mkdtempSync(join(tmpdir(), 'orca-changelog-'))
  try {
    const run = spawnSync(
      'claude',
      [
        '-p',
        CHANGELOG_PROMPT,
        '--output-format',
        'json',
        '--tools',
        '',
        '--setting-sources',
        '',
        '--strict-mcp-config',
        '--disable-slash-commands',
        '--no-session-persistence'
      ],
      { cwd, input, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 10 * 60_000 }
    )
    if (run.error) {
      throw new Error(`claude did not run: ${run.error.message}`)
    }
    const envelope = JSON.parse(run.stdout)
    if (run.status !== 0 || envelope.is_error || typeof envelope.result !== 'string') {
      throw new Error(`claude failed: ${envelope.result ?? run.stderr}`)
    }
    return envelope.result
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
}

function generateSections(commits) {
  const input = promptInput(commits)
  let lastError
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return sectionsOf(askClaude(input))
    } catch (error) {
      lastError = error
      console.error(`[changelog] attempt ${attempt + 1}: ${error.message}`)
    }
  }
  throw lastError
}

function option(name) {
  const at = process.argv.indexOf(name)
  return at > 0 ? process.argv[at + 1] : undefined
}

function main() {
  const root = git(['rev-parse', '--show-toplevel']).trim()
  process.chdir(root)
  const check = process.argv.includes('--check')
  const dryRun = process.argv.includes('--dry-run')
  const version = option('--version')
  if (!check && !dryRun && !version) {
    throw new Error('usage: custom-changelog.mjs --check | --dry-run [--version v] | --version <v>')
  }
  const changelog = readChangelog(readFileSync(resolve(CHANGELOG_PATH), 'utf8'))
  const { from, baseline } = rangeStartOf(changelog)
  if (baseline) {
    git(['fetch', '-q', 'upstream', 'main'])
  } else {
    git(['cat-file', '-e', `${from}^{commit}`])
  }
  const head = git(['rev-parse', '--short=12', 'HEAD']).trim()
  const commits = commitsSince(from)
  console.log(
    `[changelog] ${baseline ? 'first entry: everything the fork adds, ' : ''}${from}..${head}: ${commits.length} commit(s)`
  )
  if (check) {
    const claude = spawnSync('claude', ['--version'], { encoding: 'utf8' })
    console.log(`[changelog] claude: ${claude.status === 0 ? claude.stdout.trim() : 'NOT FOUND'}`)
    return
  }
  if (commits.length === 0) {
    console.log('[changelog] nothing new since the last release; no entry')
    return
  }
  const release = {
    version: version ?? '(dry run)',
    date: localDate(),
    commit: head,
    ...(baseline ? { note: BASELINE_NOTE } : {}),
    ...generateSections(commits)
  }
  if (dryRun) {
    console.log(JSON.stringify(release, null, 2))
    return
  }
  writeFileSync(resolve(CHANGELOG_PATH), formatChangelog(prependRelease(changelog, release)))
  git(['add', '--', CHANGELOG_PATH])
  // Why --only: whatever else the person has staged stays out of the release commit.
  git(['commit', '-q', '--only', '-m', `chore(changelog): ${version}`, '--', CHANGELOG_PATH], {
    stdio: 'inherit'
  })
  console.log(
    `[changelog] ${version}: ${SECTIONS.map((k) => `${release[k].length} ${k}`).join(', ')}`
  )
  console.log(
    `[changelog] committed ${git(['rev-parse', '--short=12', 'HEAD']).trim()} (not pushed)`
  )
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  try {
    main()
  } catch (error) {
    console.error(`STOP: changelog: ${error.message}`)
    process.exit(1)
  }
}
