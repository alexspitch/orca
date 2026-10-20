// `git blame --porcelain` read into the commit that last changed each line of a file.

export type GitBlameCommit = {
  sha: string
  author: string
  /** Unix seconds. */
  authorTime: number
  summary: string
  /** The file's path in this commit: differs from today's across a rename. */
  path: string
  /** The commit and path these lines came from, for the commit's diff; absent at a root commit. */
  previous?: { sha: string; path: string }
}

/** Lines `startLine` .. `startLine + lineCount - 1` (1-based) last changed by `sha`. */
export type GitBlameRange = { startLine: number; lineCount: number; sha: string }

export type GitFileBlame = { commits: Record<string, GitBlameCommit>; ranges: GitBlameRange[] }

/** Lines not committed yet: git blames them on the all-zero object id. */
export const isUncommittedBlameSha = (sha: string): boolean => /^0+$/.test(sha)

const ENTRY_HEADER = /^([0-9a-f]{40}|[0-9a-f]{64}) \d+ (\d+)(?: \d+)?$/

// Why: core.quotePath=false leaves only paths with quotes, backslashes or control characters quoted.
function unquotePath(value: string): string {
  if (!value.startsWith('"')) {
    return value
  }
  try {
    const parsed: unknown = JSON.parse(value)
    return typeof parsed === 'string' ? parsed : value
  } catch {
    return value
  }
}

export function parseGitBlamePorcelain(stdout: string): GitFileBlame {
  const commits: Record<string, GitBlameCommit> = {}
  const ranges: GitBlameRange[] = []
  let current: GitBlameCommit | null = null
  for (const text of stdout.split('\n')) {
    // A line's own text, tab-led, closes its entry; it is never read as a field.
    if (text.startsWith('\t')) {
      continue
    }
    const header = ENTRY_HEADER.exec(text)
    if (header) {
      const sha = header[1]
      const line = Number(header[2])
      current = commits[sha] ??= { sha, author: '', authorTime: 0, summary: '', path: '' }
      const last = ranges.at(-1)
      if (last && last.sha === sha && last.startLine + last.lineCount === line) {
        last.lineCount++
      } else {
        ranges.push({ startLine: line, lineCount: 1, sha })
      }
      continue
    }
    if (!current) {
      continue
    }
    const space = text.indexOf(' ')
    const key = space === -1 ? text : text.slice(0, space)
    const value = space === -1 ? '' : text.slice(space + 1)
    if (key === 'author') {
      current.author = value
    } else if (key === 'author-time') {
      current.authorTime = Number(value) || 0
    } else if (key === 'summary') {
      current.summary = value
    } else if (key === 'filename' && !current.path) {
      current.path = unquotePath(value)
    } else if (key === 'previous' && !current.previous) {
      const at = value.indexOf(' ')
      if (at > 0) {
        current.previous = { sha: value.slice(0, at), path: unquotePath(value.slice(at + 1)) }
      }
    }
  }
  return { commits, ranges }
}
