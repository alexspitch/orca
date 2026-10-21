import { describe, expect, it } from 'vitest'
import { mockupViewOf, stagedFileName } from './build-web-issue-files'

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

describe('mockupViewOf', () => {
  const base = 'https://bw.test:8585'

  it('makes the address absolute and keeps the screens', () => {
    expect(
      mockupViewOf(
        {
          base: '/mockups/tok.sig/',
          screens: [{ name: 'pages/a b.html', path: 'pages/a%20b.html' }, { name: 'x' }]
        },
        base
      )
    ).toEqual({
      base: 'https://bw.test:8585/mockups/tok.sig/',
      screens: [{ name: 'pages/a b.html', path: 'pages/a%20b.html' }]
    })
  })

  it('frames nothing outside the console’s own /mockups/', () => {
    expect(() =>
      mockupViewOf({ base: 'https://evil.test/mockups/x/', screens: [] }, base)
    ).toThrow()
    expect(() => mockupViewOf({ base: '/api/tms/issues/', screens: [] }, base)).toThrow()
    const view = mockupViewOf(
      { base: '/mockups/t/', screens: [{ name: 'a', path: 'https://evil.test/a.html' }] },
      base
    )
    expect(view.screens).toEqual([])
  })
})
