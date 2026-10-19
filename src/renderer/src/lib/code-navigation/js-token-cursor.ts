import type { CodeRange } from './code-navigation-types'
import type { JsToken } from './js-source-lexer'
import { offsetRangeToCodeRange, type LineStarts } from './source-text-positions'

export type JsTokenCursor = {
  readonly text: string
  readonly tokens: readonly JsToken[]
  readonly lineStarts: LineStarts
}

const CONTINUATION_KEYWORDS = new Set(
  (
    'extends implements typeof keyof new return default in of instanceof as satisfies await ' +
    'delete throw case is infer'
  ).split(' ')
)

const CLOSERS: Record<string, string> = { '(': ')', '[': ']', '{': '}' }

export function isPunct(cursor: JsTokenCursor, index: number, value: string): boolean {
  const token = cursor.tokens[index]
  return token !== undefined && token.kind === 'punctuation' && token.value === value
}

export function isName(cursor: JsTokenCursor, index: number, value?: string): boolean {
  const token = cursor.tokens[index]
  return (
    token !== undefined &&
    token.kind === 'identifier' &&
    (value === undefined || token.value === value)
  )
}

export function isString(cursor: JsTokenCursor, index: number): boolean {
  return cursor.tokens[index]?.kind === 'string'
}

export function tokenRange(cursor: JsTokenCursor, token: JsToken): CodeRange {
  return offsetRangeToCodeRange(cursor.lineStarts, token.start, token.end)
}

export function tokensRange(cursor: JsTokenCursor, first: number, last: number): CodeRange {
  return offsetRangeToCodeRange(
    cursor.lineStarts,
    cursor.tokens[first].start,
    cursor.tokens[last].end
  )
}

export function followsMemberAccess(cursor: JsTokenCursor, index: number): boolean {
  return isPunct(cursor, index - 1, '.') || isPunct(cursor, index - 1, '?.')
}

/** The previous token leaves an expression or type open, so a line break does not end it. */
function continuesAfter(token: JsToken): boolean {
  if (token.kind === 'identifier') {
    return CONTINUATION_KEYWORDS.has(token.value)
  }
  if (token.kind !== 'punctuation') {
    return false
  }
  return !(
    token.value === ';' ||
    token.value === ')' ||
    token.value === ']' ||
    token.value === '}' ||
    token.value === '>' ||
    token.value === '!' ||
    token.value === '++' ||
    token.value === '--'
  )
}

/** The token can only continue the previous line's expression (`.x`, `(args)`, `+ y`, `as T`). */
function continuesBefore(token: JsToken): boolean {
  if (token.kind === 'identifier') {
    return token.value === 'as' || token.value === 'satisfies' || token.value === 'instanceof'
  }
  if (token.kind === 'template') {
    return true
  }
  return (
    token.kind === 'punctuation' &&
    !(token.value === '{' || token.value === '}' || token.value === ';' || token.value === '@')
  )
}

export function isStatementStart(cursor: JsTokenCursor, index: number): boolean {
  const token = cursor.tokens[index]
  const previous = cursor.tokens[index - 1]
  if (!previous || token.lineResync) {
    return true
  }
  if (previous.kind === 'punctuation' && (previous.value === ';' || previous.value === '}')) {
    return previous.depth === token.depth
  }
  return token.newlineBefore && !continuesAfter(previous)
}

/** True when `index` is past the statement that ended at `index - 1` (ASI included). */
export function isStatementEnd(cursor: JsTokenCursor, index: number): boolean {
  const token = cursor.tokens[index]
  if (!token || (token.kind === 'punctuation' && (token.value === ';' || token.value === '}'))) {
    return true
  }
  return token.newlineBefore && !continuesBefore(token) && !continuesAfter(cursor.tokens[index - 1])
}

/**
 * Index of the bracket closing the one at `open`, or -1. A lexer resync line closes it
 * implicitly (the index before that line), so one mis-lexed line cannot swallow the file.
 */
export function matchingClose(cursor: JsTokenCursor, open: number): number {
  const opener = cursor.tokens[open]
  const closer = CLOSERS[opener.value]
  let nesting = 0
  for (let i = open; i < cursor.tokens.length; i++) {
    const token = cursor.tokens[i]
    if (i > open && token.lineResync) {
      return i - 1
    }
    if (token.kind !== 'punctuation') {
      continue
    }
    if (opener.value === '{') {
      if (i > open && token.value === '}' && token.depth === opener.depth) {
        return i
      }
    } else if (token.value === opener.value) {
      nesting++
    } else if (token.value === closer && --nesting === 0) {
      return i
    }
  }
  return -1
}

function isOpener(cursor: JsTokenCursor, index: number): boolean {
  return isPunct(cursor, index, '(') || isPunct(cursor, index, '[') || isPunct(cursor, index, '{')
}

function isCloser(cursor: JsTokenCursor, index: number): boolean {
  return isPunct(cursor, index, ')') || isPunct(cursor, index, ']') || isPunct(cursor, index, '}')
}

/** Index past a `<...>` type list at `open` followed by a call or `=>` (a return type), else -1. */
function skipTypeArguments(cursor: JsTokenCursor, open: number): number {
  let nesting = 0
  for (let i = open; i < cursor.tokens.length; i++) {
    const token = cursor.tokens[i]
    if (isOpener(cursor, i)) {
      const close = matchingClose(cursor, i)
      if (close === -1) {
        return -1
      }
      i = close
      continue
    }
    if (token.kind !== 'punctuation') {
      continue
    }
    if (token.value === '<') {
      nesting++
    } else if (token.value === '>') {
      if (--nesting === 0) {
        const after = cursor.tokens[i + 1]
        const isCallOrReturnType =
          after?.kind === 'template' ||
          (after?.kind === 'punctuation' && /^(?:\(|=>)$/.test(after.value))
        return isCallOrReturnType ? i + 1 : -1
      }
    } else if (!/^(?:,|\.|\||&|\?|:|=>)$/.test(token.value)) {
      return -1
    }
  }
  return -1
}

/**
 * Index of the `,`, closer or statement boundary ending the expression (or type, when
 * `typeContext`) that starts at `from`; bracket groups are skipped whole.
 */
export function skipExpression(cursor: JsTokenCursor, from: number, typeContext = false): number {
  let angle = 0
  let inType = typeContext
  let i = from
  while (i < cursor.tokens.length) {
    const token = cursor.tokens[i]
    if (i > from && angle === 0 && (isPunct(cursor, i, ',') || isPunct(cursor, i, ';'))) {
      return i
    }
    if (isCloser(cursor, i) || (i > from && isStatementEnd(cursor, i))) {
      return i
    }
    if (typeContext && angle === 0 && isPunct(cursor, i, '=')) {
      return i
    }
    if (isOpener(cursor, i)) {
      const close = matchingClose(cursor, i)
      if (close === -1) {
        return cursor.tokens.length
      }
      i = close + 1
      continue
    }
    if (token.kind === 'identifier' && (token.value === 'as' || token.value === 'satisfies')) {
      inType = true
    } else if (token.kind === 'punctuation' && token.value === '<') {
      if (inType) {
        angle++
      } else {
        const after = skipTypeArguments(cursor, i)
        if (after !== -1) {
          i = after
          continue
        }
      }
    } else if (inType && token.kind === 'punctuation' && token.value === '>') {
      angle = Math.max(0, angle - 1)
    }
    i++
  }
  return i
}

export type JsPatternEntry = {
  /** The property key token of `{ key: local }` / `{ local }`; null for array and nested elements. */
  key: JsToken | null
  local: JsToken
}

/** Names bound by the destructuring pattern opening at `open`, and the index past it. */
export function readBindingPattern(
  cursor: JsTokenCursor,
  open: number
): { entries: JsPatternEntry[]; next: number } {
  const close = matchingClose(cursor, open)
  if (close === -1) {
    return { entries: [], next: cursor.tokens.length }
  }
  const isObject = isPunct(cursor, open, '{')
  const entries: JsPatternEntry[] = []
  let i = open + 1
  while (i < close) {
    if (isPunct(cursor, i, ',')) {
      i++
      continue
    }
    const elementStart = i
    if (isPunct(cursor, i, '...')) {
      i++
    }
    let key: JsToken | null = null
    if (isObject && i === elementStart && isPunct(cursor, i + 1, ':')) {
      key = cursor.tokens[i].kind === 'punctuation' ? null : cursor.tokens[i]
      i += 2
    } else if (isObject && isPunct(cursor, i, '[')) {
      const computedClose = matchingClose(cursor, i)
      i = computedClose === -1 ? close : computedClose + 2
    }
    if (isPunct(cursor, i, '{') || isPunct(cursor, i, '[')) {
      const nested = readBindingPattern(cursor, i)
      entries.push(...nested.entries.map((entry) => ({ key: null, local: entry.local })))
      i = nested.next
    } else if (isName(cursor, i)) {
      const local = cursor.tokens[i]
      entries.push({ key: isObject && i === elementStart ? local : key, local })
      i++
    }
    if (i < close && !isPunct(cursor, i, ',')) {
      i = skipExpression(cursor, i)
    }
    if (i <= elementStart) {
      i = elementStart + 1
    }
  }
  return { entries, next: close + 1 }
}
