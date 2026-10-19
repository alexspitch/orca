import { PythonSourceScanner } from './python-source-scanner'
import { computeLineStarts, offsetToPosition, type LineStarts } from './source-text-positions'

export type PythonLogicalLine = {
  /** 0-based physical lines of the first and last token. */
  startLine: number
  endLine: number
  /** Offset of the first token, and just past the last one. */
  start: number
  end: number
  /** Leading whitespace width; a tab advances to the next multiple of 8. */
  indent: number
}

export type PythonSourceScan = {
  text: string
  lineStarts: LineStarts
  /** `text` with strings, comments and continuation backslashes blanked; offsets are unchanged. */
  code: string
  lines: PythonLogicalLine[]
  /** Sorted, flattened [start, end) pairs of string and comment text. */
  nonCode: readonly number[]
}

function blankRanges(text: string, ranges: readonly number[]): string {
  const parts: string[] = []
  let position = 0
  for (let k = 0; k < ranges.length; k += 2) {
    parts.push(text.slice(position, ranges[k]))
    parts.push(text.slice(ranges[k], ranges[k + 1]).replace(/[^\r\n]/g, ' '))
    position = ranges[k + 1]
  }
  parts.push(text.slice(position))
  return parts.join('')
}

export function scanPythonSource(text: string): PythonSourceScan {
  const scanner = new PythonSourceScanner(text)
  const rawLines = scanner.scanLines()
  const lineStarts = computeLineStarts(text)
  const lines = rawLines.map((line) => ({
    startLine: offsetToPosition(lineStarts, line.start).lineNumber - 1,
    endLine: offsetToPosition(lineStarts, Math.max(line.start, line.end - 1)).lineNumber - 1,
    start: line.start,
    end: line.end,
    indent: line.indent
  }))
  return {
    text,
    lineStarts,
    code: blankRanges(text, scanner.blanks),
    lines,
    nonCode: scanner.nonCode
  }
}

export function isInsidePythonStringOrComment(scan: PythonSourceScan, offset: number): boolean {
  const ranges = scan.nonCode
  let low = 0
  let high = ranges.length / 2 - 1
  while (low <= high) {
    const mid = (low + high) >> 1
    if (ranges[mid * 2 + 1] <= offset) {
      low = mid + 1
    } else if (ranges[mid * 2] > offset) {
      high = mid - 1
    } else {
      return true
    }
  }
  return false
}

/** Index of the logical line whose span holds `offset`, else the last one starting before it. */
export function logicalLineIndexAt(scan: PythonSourceScan, offset: number): number {
  let low = 0
  let high = scan.lines.length - 1
  let found = -1
  while (low <= high) {
    const mid = (low + high) >> 1
    if (scan.lines[mid].start <= offset) {
      found = mid
      low = mid + 1
    } else {
      high = mid - 1
    }
  }
  return found
}
