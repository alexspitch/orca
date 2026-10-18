import { describe, expect, it, vi } from 'vitest'
import {
  clampGitLogLimit,
  isSafeGitLogRef,
  loadGitLogPageFromExecutor,
  parseGitRefList
} from './git-log-page'
import { GIT_LOG_PAGE_DEFAULT_LIMIT, GIT_LOG_PAGE_MAX_LIMIT } from './git-log-page-types'
import type { GitHistoryExecutor } from './git-history-types'

const HEAD_OID = 'a'.repeat(40)
const OTHER_OID = 'b'.repeat(40)

function record(hash: string, message: string): string {
  return `${[hash, 'Ada', 'ada@example.com', '1700000000', '1700000000', '', '', '', message].join('\n')}\0`
}

type FakeOptions = {
  /** Revisions rev-parse resolves, by name. */
  known?: Record<string, string>
  headless?: boolean
  /** What `rev-list <oid> --not <scope>` prints; empty means the scope reaches the commit. */
  unreachable?: boolean
  /** The `--no-walk` hash check finds nothing (an author or date filter drops it). */
  hashFiltered?: boolean
}

function fakeExecutor(
  logStdout: string,
  options: FakeOptions = {}
): {
  git: GitHistoryExecutor
  calls: string[][]
} {
  const calls: string[][] = []
  const known: Record<string, string> = {
    ...(options.headless ? {} : { HEAD: HEAD_OID }),
    bbbb: OTHER_OID,
    main: HEAD_OID,
    'origin/main': HEAD_OID,
    ...options.known
  }
  const git = vi.fn(async (args: string[]) => {
    calls.push(args)
    if (args[0] === 'rev-parse') {
      const rev = args.at(-1)?.replace(/\^\{commit\}$/, '') ?? ''
      if (known[rev]) {
        return { stdout: `${known[rev]}\n` }
      }
      throw new Error('unknown revision')
    }
    if (args[0] === 'symbolic-ref') {
      return { stdout: 'feature\n' }
    }
    if (args[0] === 'rev-list') {
      return { stdout: options.unreachable ? `${OTHER_OID}\n` : '' }
    }
    if (args[0] === 'log' && args.includes('--no-walk')) {
      return { stdout: options.hashFiltered ? '' : record(OTHER_OID, 'found by hash') }
    }
    return { stdout: logStdout }
  })
  return { git, calls }
}

const logCall = (calls: string[][]): string[] =>
  calls.find((args) => args[0] === 'log' && !args.includes('--no-walk')) ?? []

describe('isSafeGitLogRef', () => {
  it('accepts branch, remote and tag names', () => {
    expect(isSafeGitLogRef('feature/x')).toBe(true)
    expect(isSafeGitLogRef('origin/main')).toBe(true)
    expect(isSafeGitLogRef('HEAD')).toBe(true)
  })

  it('rejects options, ranges and rev syntax', () => {
    for (const ref of ['-n1', '--all', 'a..b', 'main@{1}', 'main^', 'a b', 'x:y', 'a\0b', '']) {
      expect(isSafeGitLogRef(ref)).toBe(false)
    }
  })
})

describe('clampGitLogLimit', () => {
  it('defaults and clamps', () => {
    expect(clampGitLogLimit(undefined)).toBe(GIT_LOG_PAGE_DEFAULT_LIMIT)
    expect(clampGitLogLimit(0)).toBe(1)
    expect(clampGitLogLimit(10_000_000)).toBe(GIT_LOG_PAGE_MAX_LIMIT)
  })
})

describe('loadGitLogPageFromExecutor', () => {
  it('logs every branch, remote, tag and HEAD in date order by default', async () => {
    const { git, calls } = fakeExecutor(record(HEAD_OID, 'one'))
    const result = await loadGitLogPageFromExecutor(git, '/repo', { limit: 5 })
    const args = logCall(calls)
    expect(args).toContain('--date-order')
    expect(args).toContain('-n6')
    expect(args.slice(-5)).toEqual(['--branches', '--remotes', '--tags', HEAD_OID, '--'])
    expect(result.currentRef).toMatchObject({ id: 'refs/heads/feature', name: 'feature' })
    expect(result.items.map((item) => item.subject)).toEqual(['one'])
    expect(result).toMatchObject({ hasMore: false, nextSkip: 1 })
  })

  it('reports more when git returns one extra commit', async () => {
    const { git } = fakeExecutor(record(HEAD_OID, 'one') + record(OTHER_OID, 'two'))
    const result = await loadGitLogPageFromExecutor(git, '/repo', { limit: 1 })
    expect(result.items).toHaveLength(1)
    expect(result.hasMore).toBe(true)
  })

  it('pages with --skip and says where the next page starts', async () => {
    const { git, calls } = fakeExecutor(record(HEAD_OID, 'one') + record(OTHER_OID, 'two'))
    const result = await loadGitLogPageFromExecutor(git, '/repo', { limit: 5, skip: 300 })
    expect(logCall(calls)).toContain('--skip=300')
    expect(result.nextSkip).toBe(302)
  })

  it('passes fixed-string, case-insensitive filters unless asked otherwise', async () => {
    const { git, calls } = fakeExecutor('')
    await loadGitLogPageFromExecutor(git, '/repo', { text: 'fix', author: 'A.B', sinceDays: 7 })
    expect(logCall(calls)).toEqual(
      expect.arrayContaining([
        '--fixed-strings',
        '--regexp-ignore-case',
        '--grep=fix',
        '--author=A.B',
        '--since=7.days.ago'
      ])
    )
  })

  it('escapes the author for a regex search and keeps case when asked', async () => {
    const { git, calls } = fakeExecutor('')
    await loadGitLogPageFromExecutor(git, '/repo', {
      text: 'fix(.*)',
      author: 'A.B',
      regex: true,
      matchCase: true
    })
    const args = logCall(calls)
    expect(args).toContain('--extended-regexp')
    expect(args).not.toContain('--regexp-ignore-case')
    expect(args).toContain('--author=A\\.B')
  })

  it('logs only safe refs that still exist, after --end-of-options', async () => {
    const { git, calls } = fakeExecutor('')
    await loadGitLogPageFromExecutor(git, '/repo', {
      scope: { kind: 'refs', refs: ['main', '--all', 'gone', 'origin/main'] }
    })
    expect(logCall(calls).slice(-4)).toEqual(['--end-of-options', 'main', 'origin/main', '--'])
  })

  it('returns an empty page when none of the refs exist any more', async () => {
    const { git, calls } = fakeExecutor('')
    const result = await loadGitLogPageFromExecutor(git, '/repo', {
      scope: { kind: 'refs', refs: ['gone', '--all'] }
    })
    expect(result.items).toEqual([])
    expect(calls.some((args) => args[0] === 'log')).toBe(false)
  })

  it('puts a reachable commit found by hash prefix first', async () => {
    const { git, calls } = fakeExecutor(record(HEAD_OID, 'one'))
    const result = await loadGitLogPageFromExecutor(git, '/repo', { text: 'bbbb', author: 'Ada' })
    expect(result.items.map((item) => item.subject)).toEqual(['found by hash', 'one'])
    const hashCheck = calls.find((args) => args.includes('--no-walk')) ?? []
    expect(hashCheck).toContain('--author=Ada')
    expect(result.nextSkip).toBe(1)
  })

  it('ignores a hash match the filters drop or the scope does not reach', async () => {
    for (const options of [{ hashFiltered: true }, { unreachable: true }]) {
      const { git } = fakeExecutor(record(HEAD_OID, 'one'), options)
      const result = await loadGitLogPageFromExecutor(git, '/repo', { text: 'bbbb' })
      expect(result.items.map((item) => item.subject)).toEqual(['one'])
    }
  })

  it('still logs the branches when HEAD is unborn', async () => {
    const { git, calls } = fakeExecutor(record(OTHER_OID, 'on a branch'), { headless: true })
    const result = await loadGitLogPageFromExecutor(git, '/repo')
    expect(logCall(calls).slice(-4)).toEqual(['--branches', '--remotes', '--tags', '--'])
    expect(result.items.map((item) => item.subject)).toEqual(['on a branch'])
    expect(result.currentRef).toBeUndefined()
  })

  it('returns nothing when an unborn repo has nothing to log', async () => {
    const git = vi.fn(async () => {
      throw new Error('unborn')
    })
    const result = await loadGitLogPageFromExecutor(git, '/repo')
    expect(result).toMatchObject({ items: [], hasMore: false })
  })
})

describe('parseGitRefList', () => {
  it('reads kinds, peeled tags, upstreams and HEAD, skipping remote HEAD', () => {
    const tagObject = 'c'.repeat(40)
    const stdout = [
      ['refs/heads/main', HEAD_OID, '', 'refs/remotes/origin/main', '*'],
      ['refs/remotes/origin/HEAD', HEAD_OID, '', '', ''],
      ['refs/remotes/origin/main', HEAD_OID, '', '', ''],
      ['refs/tags/v1', tagObject, OTHER_OID, '', ''],
      ['refs/notes/commits', HEAD_OID, '', '', '']
    ]
      .map((fields) => fields.join('\0'))
      .join('\n')
    expect(parseGitRefList(stdout)).toEqual([
      {
        fullName: 'refs/heads/main',
        shortName: 'main',
        kind: 'local',
        oid: HEAD_OID,
        upstream: 'refs/remotes/origin/main',
        isHead: true
      },
      {
        fullName: 'refs/remotes/origin/main',
        shortName: 'origin/main',
        kind: 'remote',
        oid: HEAD_OID,
        isHead: false
      },
      {
        fullName: 'refs/tags/v1',
        shortName: 'v1',
        kind: 'tag',
        oid: OTHER_OID,
        isHead: false
      }
    ])
  })
})
