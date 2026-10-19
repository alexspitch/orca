import { describe, expect, it } from 'vitest'
import { EMPTY_LOG_LINES, appendLogText } from './log-lines'
import { advanceLogSearch, matchesOnLine } from './log-search'

describe('find in a growing log', () => {
  it('matches without regard to case, several to a line', () => {
    const log = appendLogText(EMPTY_LOG_LINES, 'Error here\nerror and ERROR\nok\n', 100)
    const search = advanceLogSearch(null, log, 'error')
    expect(search.matches.map((m) => [m.line, m.start])).toEqual([
      [0, 0],
      [1, 0],
      [1, 10]
    ])
  })

  it('scans only what was added, and forgets lines that rolled away', () => {
    let log = appendLogText(EMPTY_LOG_LINES, 'x1\ny\n', 2)
    let search = advanceLogSearch(null, log, 'x')
    expect(search.matches).toHaveLength(1)
    log = appendLogText(log, 'x2\nz\n', 2)
    search = advanceLogSearch(search, log, 'x')
    expect(search.matches.map((m) => m.line)).toEqual([2])
  })

  it('counts a match in the unfinished line without settling it', () => {
    const log = appendLogText(EMPTY_LOG_LINES, 'a\nbeta', 100)
    const search = advanceLogSearch(null, log, 'bet')
    expect(search.matches).toEqual([{ line: 1, start: 0, end: 3 }])
    expect(search.settled).toEqual([])
  })

  it('starts over when the query changes', () => {
    const log = appendLogText(EMPTY_LOG_LINES, 'abc\n', 100)
    const first = advanceLogSearch(null, log, 'a')
    expect(advanceLogSearch(first, log, 'c').matches).toEqual([{ line: 0, start: 2, end: 3 }])
    expect(advanceLogSearch(first, log, '').matches).toEqual([])
  })

  it('picks out the matches of one line', () => {
    const matches = [
      { line: 1, start: 0, end: 1 },
      { line: 3, start: 0, end: 1 },
      { line: 3, start: 4, end: 5 }
    ]
    expect(matchesOnLine(matches, 3)).toHaveLength(2)
    expect(matchesOnLine(matches, 2)).toEqual([])
  })
})
