// A log as lines: whole lines in a window of the newest ones, the unfinished last line kept apart
// until the rest of it arrives.

export type LogLines = {
  lines: readonly string[]
  /** The last line while it has no newline yet. */
  partial: string
  /** Absolute number of `lines[0]`, counting the lines dropped from the window. */
  first: number
}

export const EMPTY_LOG_LINES: LogLines = { lines: [], partial: '', first: 0 }

/** Add a piece of text; a finished log turns its unfinished line into a whole one. */
export function appendLogText(
  log: LogLines,
  text: string,
  maxLines: number,
  done = false
): LogLines {
  if (!text && !(done && log.partial)) {
    return log
  }
  const pieces = (log.partial + text).split(/\r?\n/)
  const partial = done ? '' : (pieces.pop() ?? '')
  if (done && pieces.at(-1) === '') {
    pieces.pop()
  }
  const lines = pieces.length ? [...log.lines, ...pieces] : log.lines
  const dropped = Math.max(0, lines.length - maxLines)
  return {
    lines: dropped ? lines.slice(dropped) : lines,
    partial,
    first: log.first + dropped
  }
}

/** Every line on screen, the unfinished one included. */
export function visibleLogLines(log: LogLines): readonly string[] {
  return log.partial ? [...log.lines, log.partial] : log.lines
}

/** A whole text at once (a build log already read as text). */
export function logLinesOf(text: string, maxLines: number): LogLines {
  return appendLogText(EMPTY_LOG_LINES, text, maxLines, true)
}
