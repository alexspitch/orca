import type { CodePosition, CodeRange } from './code-navigation-types'

export type LineStarts = readonly number[]

export function computeLineStarts(text: string): LineStarts {
  const starts = [0]
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i)
    if (ch === 10) {
      starts.push(i + 1)
    } else if (ch === 13) {
      if (text.charCodeAt(i + 1) === 10) {
        i++
      }
      starts.push(i + 1)
    }
  }
  return starts
}

export function offsetToPosition(lineStarts: LineStarts, offset: number): CodePosition {
  let low = 0
  let high = lineStarts.length - 1
  while (low < high) {
    const mid = (low + high + 1) >> 1
    if (lineStarts[mid] <= offset) {
      low = mid
    } else {
      high = mid - 1
    }
  }
  return { lineNumber: low + 1, column: offset - lineStarts[low] + 1 }
}

export function positionToOffset(lineStarts: LineStarts, position: CodePosition): number {
  const lineIndex = Math.min(Math.max(position.lineNumber - 1, 0), lineStarts.length - 1)
  return lineStarts[lineIndex] + Math.max(position.column - 1, 0)
}

export function offsetRangeToCodeRange(
  lineStarts: LineStarts,
  startOffset: number,
  endOffset: number
): CodeRange {
  const start = offsetToPosition(lineStarts, startOffset)
  const end = offsetToPosition(lineStarts, endOffset)
  return {
    startLineNumber: start.lineNumber,
    startColumn: start.column,
    endLineNumber: end.lineNumber,
    endColumn: end.column
  }
}

/** Single-line range on a 1-based line, `length` characters from a 1-based column. */
export function lineRange(lineNumber: number, column: number, length: number): CodeRange {
  return {
    startLineNumber: lineNumber,
    startColumn: column,
    endLineNumber: lineNumber,
    endColumn: column + length
  }
}

export function rangeContainsPosition(range: CodeRange, position: CodePosition): boolean {
  if (position.lineNumber < range.startLineNumber || position.lineNumber > range.endLineNumber) {
    return false
  }
  if (position.lineNumber === range.startLineNumber && position.column < range.startColumn) {
    return false
  }
  return !(position.lineNumber === range.endLineNumber && position.column > range.endColumn)
}

const IDENTIFIER_PART = /[A-Za-z0-9_$]/

/** The identifier touching `position` (Monaco treats the char before the cursor as touching). */
export function identifierAtPosition(
  text: string,
  lineStarts: LineStarts,
  position: CodePosition,
  allowDollar: boolean
): { name: string; range: CodeRange; startOffset: number } | null {
  const offset = positionToOffset(lineStarts, position)
  const isPart = (ch: string | undefined): boolean =>
    ch !== undefined && IDENTIFIER_PART.test(ch) && (allowDollar || ch !== '$')
  let start = offset
  while (start > 0 && isPart(text[start - 1])) {
    start--
  }
  let end = offset
  while (end < text.length && isPart(text[end])) {
    end++
  }
  if (start === end || /[0-9]/.test(text[start])) {
    return null
  }
  return {
    name: text.slice(start, end),
    range: offsetRangeToCodeRange(lineStarts, start, end),
    startOffset: start
  }
}
