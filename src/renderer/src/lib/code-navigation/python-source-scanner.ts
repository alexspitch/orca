/** One logical line's first-token offset, end of its last token, and indent width. */
export type RawLogicalLine = { start: number; end: number; indent: number }

const LF = 10
const CR = 13
const TAB = 9
const FF = 12
const SPACE = 32
const BOM = 0xfeff
const DOUBLE_QUOTE = 34
const SINGLE_QUOTE = 39
const HASH = 35
const BACKSLASH = 92
const BANG = 33
const EQUALS = 61
const COLON = 58
const OPEN_BRACE = 123
const CLOSE_BRACE = 125
const OPENERS = new Set([40, 91, OPEN_BRACE])
const CLOSERS = new Set([41, 93, CLOSE_BRACE])

const STRING_PREFIXES = new Set(['r', 'u', 'b', 'f', 't', 'br', 'rb', 'fr', 'rf', 'tr', 'rt'])
// Why: `def`/`class` can never continue a bracketed expression, so an unclosed bracket ends there.
const DEFINITION_START = /[ \t]*(?:async[ \t]+)?(?:def|class)[ \t]/y

function isNewline(ch: number): boolean {
  return ch === LF || ch === CR
}

function isQuote(ch: number): boolean {
  return ch === DOUBLE_QUOTE || ch === SINGLE_QUOTE
}

function isWordChar(ch: number): boolean {
  return (
    (ch >= 48 && ch <= 57) ||
    (ch >= 65 && ch <= 90) ||
    (ch >= 97 && ch <= 122) ||
    ch === 95 ||
    (ch >= 128 && ch !== BOM)
  )
}

function skipNewline(text: string, i: number): number {
  return text.charCodeAt(i) === CR && text.charCodeAt(i + 1) === LF ? i + 2 : i + 1
}

function measureIndent(text: string, from: number, to: number): number {
  let width = 0
  for (let i = from; i < to; i++) {
    const ch = text.charCodeAt(i)
    if (ch === TAB) {
      width = (Math.floor(width / 8) + 1) * 8
    } else if (ch === FF) {
      width = 0
    } else if (ch === SPACE) {
      width++
    }
  }
  return width
}

/** Char-level pass: strings (incl. f-string fields), comments, brackets and logical lines. */
export class PythonSourceScanner {
  readonly nonCode: number[] = []
  readonly blanks: number[] = []
  private readonly length: number

  constructor(private readonly text: string) {
    this.length = text.length
  }

  private markNonCode(start: number, end: number): void {
    if (end > start) {
      this.nonCode.push(start, end)
      this.blanks.push(start, end)
    }
  }

  scanLines(): RawLogicalLine[] {
    const { text, length } = this
    const lines: RawLogicalLine[] = []
    let open: { start: number; indent: number } | null = null
    let depth = 0
    let lastEnd = 0
    let continued = false
    let physicalStart = 0
    let atLineStart = true
    const close = (): void => {
      if (open) {
        lines.push({ start: open.start, end: lastEnd, indent: open.indent })
        open = null
      }
    }
    let i = 0
    while (i < length) {
      const ch = text.charCodeAt(i)
      if (isNewline(ch)) {
        i = skipNewline(text, i)
        if (depth === 0 && !continued) {
          close()
        }
        continued = false
        physicalStart = i
        atLineStart = true
        continue
      }
      if (atLineStart) {
        atLineStart = false
        DEFINITION_START.lastIndex = i
        if (open && depth > 0 && DEFINITION_START.test(text)) {
          depth = 0
          close()
        }
      }
      if (ch === SPACE || ch === TAB || ch === FF || ch === BOM) {
        i++
        continue
      }
      if (ch === HASH) {
        let end = i
        while (end < length && !isNewline(text.charCodeAt(end))) {
          end++
        }
        this.markNonCode(i, end)
        i = end
        continue
      }
      if (ch === BACKSLASH && isNewline(text.charCodeAt(i + 1))) {
        this.blanks.push(i, i + 1)
        continued = true
        i++
        continue
      }
      open ??= { start: i, indent: measureIndent(text, physicalStart, i) }
      if (OPENERS.has(ch)) {
        depth++
      } else if (CLOSERS.has(ch)) {
        depth = Math.max(0, depth - 1)
      }
      i = isWordChar(ch) || isQuote(ch) ? this.scanWordOrString(i) : i + 1
      lastEnd = i
    }
    close()
    return lines
  }

  /** Returns the end of a word, or of a string when the word is a string prefix. */
  private scanWordOrString(start: number): number {
    const { text, length } = this
    let end = start
    while (end < length && isWordChar(text.charCodeAt(end))) {
      end++
    }
    if (!isQuote(text.charCodeAt(end))) {
      return end
    }
    if (end === start || STRING_PREFIXES.has(text.slice(start, end).toLowerCase())) {
      return this.scanString(start, end)
    }
    return end
  }

  private scanString(tokenStart: number, quoteAt: number): number {
    const { text, length } = this
    const prefix = text.slice(tokenStart, quoteAt).toLowerCase()
    const formatted = prefix.includes('f') || prefix.includes('t')
    const quote = text.charCodeAt(quoteAt)
    const triple = text.charCodeAt(quoteAt + 1) === quote && text.charCodeAt(quoteAt + 2) === quote
    let segmentStart = tokenStart
    let j = quoteAt + (triple ? 3 : 1)
    while (j < length) {
      const ch = text.charCodeAt(j)
      if (ch === BACKSLASH) {
        j = j + 1 < length ? skipNewline(text, j + 1) : j + 1
        continue
      }
      if (isNewline(ch)) {
        if (!triple) {
          break
        }
        j++
        continue
      }
      if (
        ch === quote &&
        (!triple || (text.charCodeAt(j + 1) === quote && text.charCodeAt(j + 2) === quote))
      ) {
        j += triple ? 3 : 1
        this.markNonCode(segmentStart, j)
        return j
      }
      if (formatted && ch === OPEN_BRACE) {
        if (text.charCodeAt(j + 1) === OPEN_BRACE) {
          j += 2
          continue
        }
        this.markNonCode(segmentStart, j + 1)
        j = this.scanReplacementField(j + 1, triple)
        segmentStart = j
        if (text.charCodeAt(j) === CLOSE_BRACE) {
          j++
        }
        continue
      }
      j++
    }
    this.markNonCode(segmentStart, j)
    return j
  }

  /** f-string `{...}` expression; returns the offset of its closing brace (or where it broke off). */
  private scanReplacementField(start: number, multiline: boolean): number {
    const { text, length } = this
    let depth = 0
    let j = start
    while (j < length) {
      const ch = text.charCodeAt(j)
      if (isNewline(ch) && !multiline) {
        return j
      }
      if (isWordChar(ch) || isQuote(ch)) {
        j = this.scanWordOrString(j)
        continue
      }
      if (ch === CLOSE_BRACE && depth === 0) {
        return j
      }
      if (OPENERS.has(ch)) {
        depth++
      } else if (CLOSERS.has(ch)) {
        depth--
      } else if (
        depth === 0 &&
        (ch === COLON || (ch === BANG && text.charCodeAt(j + 1) !== EQUALS))
      ) {
        return this.scanFormatSpec(j, multiline)
      }
      j++
    }
    return j
  }

  private scanFormatSpec(start: number, multiline: boolean): number {
    const { text, length } = this
    let segmentStart = start
    let j = start
    while (j < length) {
      const ch = text.charCodeAt(j)
      if ((isNewline(ch) && !multiline) || ch === CLOSE_BRACE || isQuote(ch)) {
        break
      }
      if (ch === OPEN_BRACE) {
        this.markNonCode(segmentStart, j + 1)
        j = this.scanReplacementField(j + 1, multiline)
        segmentStart = j
        if (text.charCodeAt(j) === CLOSE_BRACE) {
          j++
        }
        continue
      }
      j++
    }
    this.markNonCode(segmentStart, j)
    return j
  }
}
