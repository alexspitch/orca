import { describe, expect, it } from 'vitest'
import { isUncommittedBlameSha, parseGitBlamePorcelain } from './git-blame'

const A = 'a'.repeat(40)
const B = 'b'.repeat(40)
const P = 'c'.repeat(40)
const ZERO = '0'.repeat(40)

// What `git blame --porcelain --contents -` prints: commit fields only on a commit's first line.
const PORCELAIN = [
  `${A} 1 1 2`,
  'author Ivan',
  'author-mail <ivan@example.test>',
  'author-time 1756800000',
  'author-tz +0200',
  'committer Ivan',
  'summary IS-71 fix(dc): fail fast without a host',
  `previous ${P} src/old name.ts`,
  'filename src/name.ts',
  '\tconst host = cfg.host',
  `${A} 2 2`,
  '\tif (!host) {',
  `${B} 5 3 1`,
  'author Alex',
  'author-time 1760700000',
  'summary IS-147 feat: services',
  'boundary',
  'filename src/name.ts',
  `\t${A} 9 9 9`,
  `${ZERO} 4 4 1`,
  'author Not Committed Yet',
  'author-time 1760900000',
  'summary Version of src/name.ts from -',
  'filename src/name.ts',
  '\t}',
  `${A} 3 5 1`,
  'filename src/name.ts',
  '\treturn host',
  ''
].join('\n')

describe('parseGitBlamePorcelain', () => {
  const blame = parseGitBlamePorcelain(PORCELAIN)

  it('groups consecutive lines of one commit into ranges, in file order', () => {
    expect(blame.ranges).toEqual([
      { startLine: 1, lineCount: 2, sha: A },
      { startLine: 3, lineCount: 1, sha: B },
      { startLine: 4, lineCount: 1, sha: ZERO },
      { startLine: 5, lineCount: 1, sha: A }
    ])
  })

  it('keeps each commit once, with where its lines came from', () => {
    expect(blame.commits[A]).toEqual({
      sha: A,
      author: 'Ivan',
      authorTime: 1756800000,
      summary: 'IS-71 fix(dc): fail fast without a host',
      path: 'src/name.ts',
      previous: { sha: P, path: 'src/old name.ts' }
    })
    expect(blame.commits[B].previous).toBeUndefined()
  })

  it('never reads a line of the file as a field', () => {
    expect(Object.keys(blame.commits)).toEqual([A, B, ZERO])
  })

  it('marks lines not committed yet', () => {
    expect(isUncommittedBlameSha(ZERO)).toBe(true)
    expect(isUncommittedBlameSha(A)).toBe(false)
  })

  it('reads a quoted path', () => {
    const quoted = parseGitBlamePorcelain(`${A} 1 1 1\nfilename "a \\"b\\".ts"\n\tx\n`)
    expect(quoted.commits[A].path).toBe('a "b".ts')
  })
})
