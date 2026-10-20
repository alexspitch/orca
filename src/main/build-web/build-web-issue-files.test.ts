import { describe, expect, it } from 'vitest'
import { stagedFileName } from './build-web-issue-files'

describe('stagedFileName', () => {
  it('keeps a plain name and its extension', () => {
    expect(stagedFileName('Отчёт по звонку.md')).toBe('Отчёт по звонку.md')
  })

  it('never leaves a path or a hidden name', () => {
    expect(stagedFileName('../../etc/passwd')).toBe('_.._etc_passwd')
    expect(stagedFileName('a\\b:c?.html')).toBe('a_b_c_.html')
    expect(stagedFileName('...')).toBe('file')
  })
})
