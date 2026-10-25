import { describe, expect, it } from 'vitest'
import { parseSourceFileRef, sourceFileRefMatches, sourceFileRefOfCode } from './source-file-ref'

describe('parseSourceFileRef', () => {
  it('reads a file with a line or a range', () => {
    expect(parseSourceFileRef('exec_input_node.py:160-257')).toEqual({
      path: 'exec_input_node.py',
      line: 160,
      endLine: 257
    })
    expect(parseSourceFileRef('applications/sa-ui/package.json:11')).toEqual({
      path: 'applications/sa-ui/package.json',
      line: 11
    })
    expect(parseSourceFileRef('./src/a.ts:3:7')).toEqual({ path: 'src/a.ts', line: 3 })
    expect(parseSourceFileRef('IssuePlanTab.tsx:42-60')).toEqual({
      path: 'IssuePlanTab.tsx',
      line: 42,
      endLine: 60
    })
  })

  it('takes a path without a line, but not a bare name', () => {
    expect(parseSourceFileRef('utils/design-lint/run.js')).toEqual({
      path: 'utils/design-lint/run.js'
    })
    expect(parseSourceFileRef('os.path')).toBeNull()
    expect(parseSourceFileRef('config.yaml')).toBeNull()
  })

  it('leaves code that is not a file alone', () => {
    expect(parseSourceFileRef('docker compose up -d')).toBeNull()
    expect(parseSourceFileRef('v1.2:3')).toBeNull()
    expect(parseSourceFileRef('a.ts:0')).toBeNull()
    expect(parseSourceFileRef('https://x.test/a.ts:3')).toBeNull()
  })
})

describe('sourceFileRefMatches', () => {
  it('keeps the paths ending in the reference, nearest the root first', () => {
    expect(
      sourceFileRefMatches(
        ['a/b/node.py', 'node.py.bak', 'x/node.py', 'a\\b\\node.py', 'my_node.py'],
        'node.py'
      )
    ).toEqual(['x/node.py', 'a/b/node.py'])
    expect(sourceFileRefMatches(['a/b/node.py', 'c/node.py'], 'b/node.py')).toEqual(['a/b/node.py'])
  })
})

describe('sourceFileRefOfCode', () => {
  it('reads inline code and leaves fenced blocks alone', () => {
    expect(sourceFileRefOfCode(undefined, 'a/b.py:3')?.ref).toEqual({ path: 'a/b.py', line: 3 })
    expect(sourceFileRefOfCode(undefined, ['a/b.py:3'])?.text).toBe('a/b.py:3')
    expect(sourceFileRefOfCode('language-py', 'a/b.py:3')).toBeNull()
    expect(sourceFileRefOfCode(undefined, 'a/b.py:3\n')).toBeNull()
  })
})
