import { describe, expect, it } from 'vitest'
import { EMPTY_LOG_LINES, appendLogText, logLinesOf, visibleLogLines } from './log-lines'

describe('a log as lines', () => {
  it('keeps an unfinished line apart until its newline arrives', () => {
    let log = appendLogText(EMPTY_LOG_LINES, 'one\ntw', 100)
    expect(log.lines).toEqual(['one'])
    expect(log.partial).toBe('tw')
    expect(visibleLogLines(log)).toEqual(['one', 'tw'])
    log = appendLogText(log, 'o\r\nthree\n', 100)
    expect(log.lines).toEqual(['one', 'two', 'three'])
    expect(log.partial).toBe('')
  })

  it('drops the oldest lines past the window and counts them', () => {
    const log = appendLogText(EMPTY_LOG_LINES, 'a\nb\nc\nd\n', 2)
    expect(log.lines).toEqual(['c', 'd'])
    expect(log.first).toBe(2)
  })

  it('makes the unfinished line whole when the log is over', () => {
    const log = appendLogText(appendLogText(EMPTY_LOG_LINES, 'a\nb', 10), '', 10, true)
    expect(log.lines).toEqual(['a', 'b'])
    expect(log.partial).toBe('')
  })

  it('reads a whole text without a trailing empty line', () => {
    expect(logLinesOf('a\nb\n', 10).lines).toEqual(['a', 'b'])
  })
})
