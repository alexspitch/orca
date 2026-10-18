import {
  GIT_HISTORY_COMMIT_FORMAT,
  parseGitHistoryLog,
  shortGitHash
} from './git-history-log-parser'
import type { GitHistoryExecutor, GitHistoryItem, GitHistoryItemRef } from './git-history-types'
import {
  GIT_LOG_PAGE_DEFAULT_LIMIT,
  GIT_LOG_PAGE_MAX_LIMIT,
  GIT_LOG_PAGE_MAX_REFS,
  GIT_LOG_PAGE_MAX_SINCE_DAYS,
  type GitLogPageResult,
  type GitLogQuery,
  type GitLogScope,
  type GitRefEntry,
  type GitRefKind,
  type GitRefsContainingResult,
  type GitRefsResult
} from './git-log-page-types'

const REF_FORMAT = '%(refname)%00%(objectname)%00%(*objectname)%00%(upstream)%00%(HEAD)'
const REMOTE_HEAD_REF = /^refs\/remotes\/[^/]+\/HEAD$/
const FULL_OID = /^(?:[0-9a-fA-F]{40}|[0-9a-fA-F]{64})$/
const HASH_PREFIX = /^[0-9a-fA-F]{4,64}$/

export function clampGitLogLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) {
    return GIT_LOG_PAGE_DEFAULT_LIMIT
  }
  return Math.min(GIT_LOG_PAGE_MAX_LIMIT, Math.max(1, Math.trunc(limit)))
}

const UNSAFE_REF_CHARS = new Set(['~', '^', ':', '?', '*', '[', '\\'])

function hasUnsafeRefChar(ref: string): boolean {
  for (const char of ref) {
    const code = char.charCodeAt(0)
    if (code <= 0x20 || code === 0x7f || UNSAFE_REF_CHARS.has(char) || /\s/.test(char)) {
      return true
    }
  }
  return false
}

// Why: refs reach git argv; a dash, whitespace or range syntax could turn one into an option or a range.
export function isSafeGitLogRef(ref: string): boolean {
  return (
    ref.length > 0 &&
    ref.length <= 1024 &&
    !ref.startsWith('-') &&
    !ref.includes('..') &&
    !ref.includes('@{') &&
    !hasUnsafeRefChar(ref)
  )
}

function escapeExtendedRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function logFormatArgs(count: number, skip = 0): string[] {
  return [
    'log',
    '--no-show-signature',
    '--no-color',
    `--format=${GIT_HISTORY_COMMIT_FORMAT}`,
    '-z',
    '--date-order',
    '--decorate=full',
    `-n${count}`,
    ...(skip > 0 ? [`--skip=${skip}`] : [])
  ]
}

function authorAndSinceArgs(query: GitLogQuery): string[] {
  const args: string[] = []
  const author = query.author?.trim()
  if (author) {
    args.push(`--author=${query.regex === true ? escapeExtendedRegex(author) : author}`)
  }
  const since = query.sinceDays
  if (since !== undefined && Number.isFinite(since) && since > 0) {
    args.push(`--since=${Math.min(Math.trunc(since), GIT_LOG_PAGE_MAX_SINCE_DAYS)}.days.ago`)
  }
  return args
}

function filterArgs(query: GitLogQuery): string[] {
  const args: string[] = []
  const text = query.text?.trim()
  if (text || query.author?.trim()) {
    args.push(query.regex === true ? '--extended-regexp' : '--fixed-strings')
    if (query.matchCase !== true) {
      args.push('--regexp-ignore-case')
    }
  }
  if (text) {
    args.push(`--grep=${text}`)
  }
  return [...args, ...authorAndSinceArgs(query)]
}

async function resolveCommit(
  git: GitHistoryExecutor,
  cwd: string,
  rev: string
): Promise<string | null> {
  try {
    const { stdout } = await git(
      ['rev-parse', '--verify', '--end-of-options', `${rev}^{commit}`],
      cwd
    )
    return stdout.trim() || null
  } catch {
    return null
  }
}

/** The revisions a scope logs, without separators; null when none of its refs exist. */
async function scopeRevisions(
  git: GitHistoryExecutor,
  cwd: string,
  scope: GitLogScope | undefined,
  headOid: string | null
): Promise<string[] | null> {
  if (!scope || scope.kind === 'all') {
    return ['--branches', '--remotes', '--tags', ...(headOid ? [headOid] : [])]
  }
  // Why resolve first: a ref deleted since it was picked (fetch --prune) makes git log fail outright.
  const candidates = scope.refs.filter(isSafeGitLogRef).slice(0, GIT_LOG_PAGE_MAX_REFS)
  const resolved = await Promise.all(candidates.map((ref) => resolveCommit(git, cwd, ref)))
  const refs = candidates.filter((_, index) => resolved[index] !== null)
  return refs.length > 0 ? refs : null
}

// Why two shapes: pseudo-options such as --branches can't follow --end-of-options.
function logRevisionArgs(scope: GitLogScope | undefined, revisions: string[]): string[] {
  return scope?.kind === 'refs' ? ['--end-of-options', ...revisions, '--'] : [...revisions, '--']
}

async function resolveCurrentRef(
  git: GitHistoryExecutor,
  cwd: string,
  headOid: string
): Promise<GitHistoryItemRef> {
  try {
    const { stdout } = await git(['symbolic-ref', '--quiet', '--short', 'HEAD'], cwd)
    const branch = stdout.trim()
    if (branch) {
      return {
        id: `refs/heads/${branch}`,
        name: branch,
        revision: headOid,
        category: 'branches'
      }
    }
  } catch {
    // Detached HEAD.
  }
  return {
    id: headOid,
    name: shortGitHash(headOid),
    revision: headOid,
    category: 'commits'
  }
}

/**
 * The text read as a hash prefix: only a commit that the author and date filters keep
 * (`--no-walk` tests it alone) and that the scope reaches, never a dangling object.
 */
async function findCommitByHash(
  git: GitHistoryExecutor,
  cwd: string,
  query: GitLogQuery,
  revisions: string[]
): Promise<GitHistoryItem | null> {
  const candidate = query.text?.trim()
  if (!candidate || !HASH_PREFIX.test(candidate)) {
    return null
  }
  const oid = await resolveCommit(git, cwd, candidate)
  if (!oid) {
    return null
  }
  const { stdout } = await git(
    [...logFormatArgs(1), '--no-walk', ...authorAndSinceArgs(query), '--end-of-options', oid, '--'],
    cwd
  )
  const item = parseGitHistoryLog(stdout)[0]
  if (!item) {
    return null
  }
  try {
    // rev-list prints the commit only when no scope revision reaches it.
    const reach = await git(['rev-list', '-n1', oid, '--not', ...revisions, '--'], cwd)
    return reach.stdout.trim() === '' ? item : null
  } catch {
    return null
  }
}

export async function loadGitLogPageFromExecutor(
  git: GitHistoryExecutor,
  cwd: string,
  query: GitLogQuery = {}
): Promise<GitLogPageResult> {
  const limit = clampGitLogLimit(query.limit)
  const skip = Math.max(0, Math.trunc(query.skip ?? 0))
  const headOid = await resolveCommit(git, cwd, 'HEAD')
  const currentRef = headOid ? await resolveCurrentRef(git, cwd, headOid) : undefined
  const revisions = await scopeRevisions(git, cwd, query.scope, headOid)
  if (!revisions) {
    return { items: [], currentRef, hasMore: false, limit, nextSkip: skip }
  }
  const args = [
    ...logFormatArgs(limit + 1, skip),
    ...filterArgs(query),
    ...logRevisionArgs(query.scope, revisions)
  ]
  let stdout: string
  try {
    stdout = (await git(args, cwd)).stdout
  } catch (error) {
    // An unborn HEAD in a repo with no refs at all has nothing to log.
    if (!headOid) {
      return { items: [], hasMore: false, limit, nextSkip: skip }
    }
    throw error
  }
  const parsed = parseGitHistoryLog(stdout)
  const items = parsed.slice(0, limit)
  const nextSkip = skip + items.length
  const hashHit = skip === 0 ? await findCommitByHash(git, cwd, query, revisions) : null
  if (hashHit && !items.some((item) => item.id === hashHit.id)) {
    items.unshift(hashHit)
  }
  return { items, currentRef, hasMore: parsed.length > limit, limit, nextSkip }
}

function refKind(fullName: string): GitRefKind | null {
  if (fullName.startsWith('refs/heads/')) {
    return 'local'
  }
  if (fullName.startsWith('refs/remotes/')) {
    return REMOTE_HEAD_REF.test(fullName) ? null : 'remote'
  }
  return fullName.startsWith('refs/tags/') ? 'tag' : null
}

export function shortGitRefName(fullName: string): string {
  return fullName.replace(/^refs\/(?:heads|remotes|tags)\//, '')
}

export function parseGitRefList(stdout: string): GitRefEntry[] {
  const refs: GitRefEntry[] = []
  for (const line of stdout.split('\n')) {
    const [fullName = '', objectName = '', peeled = '', upstream = '', head = ''] = line.split('\0')
    const kind = refKind(fullName)
    const oid = peeled.trim() || objectName.trim()
    if (!kind || !FULL_OID.test(oid)) {
      continue
    }
    refs.push({
      fullName,
      shortName: shortGitRefName(fullName),
      kind,
      oid,
      ...(upstream.trim() ? { upstream: upstream.trim() } : {}),
      isHead: head.trim() === '*'
    })
  }
  return refs
}

export async function listGitRefsFromExecutor(
  git: GitHistoryExecutor,
  cwd: string
): Promise<GitRefsResult> {
  const [{ stdout }, userName] = await Promise.all([
    git(['for-each-ref', `--format=${REF_FORMAT}`, 'refs/heads', 'refs/remotes', 'refs/tags'], cwd),
    git(['config', '--get', 'user.name'], cwd).then(
      (result) => result.stdout.trim() || undefined,
      () => undefined
    )
  ])
  return { refs: parseGitRefList(stdout), ...(userName ? { userName } : {}) }
}

export async function listGitRefsContainingFromExecutor(
  git: GitHistoryExecutor,
  cwd: string,
  commitId: string
): Promise<GitRefsContainingResult> {
  if (!FULL_OID.test(commitId)) {
    return { refs: [] }
  }
  const [{ stdout }, inHead] = await Promise.all([
    git(
      [
        'for-each-ref',
        `--contains=${commitId}`,
        '--format=%(refname)',
        'refs/heads',
        'refs/remotes'
      ],
      cwd
    ),
    // Exit 1 means "not an ancestor", which the executor surfaces as a rejection.
    git(['merge-base', '--is-ancestor', commitId, 'HEAD'], cwd).then(
      () => true,
      () => false
    )
  ])
  const names = stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((fullName) => fullName && !REMOTE_HEAD_REF.test(fullName))
    .map(shortGitRefName)
  return { refs: inHead ? ['HEAD', ...names] : names }
}
