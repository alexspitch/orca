import { describe, expect, it } from 'vitest'
import { lineShasOf } from './editor-git-blame-store'

describe('lineShasOf', () => {
  it('spreads ranges over their lines', () => {
    const shas = lineShasOf({
      commits: {},
      ranges: [
        { startLine: 1, lineCount: 2, sha: 'a' },
        { startLine: 3, lineCount: 1, sha: 'b' },
        { startLine: 4, lineCount: 2, sha: 'a' }
      ]
    })
    expect(shas).toEqual(['a', 'a', 'b', 'a', 'a'])
  })
})
