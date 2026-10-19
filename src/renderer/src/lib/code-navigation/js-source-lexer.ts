export type JsTokenKind = 'identifier' | 'string' | 'template' | 'number' | 'regex' | 'punctuation'

export type JsToken = {
  kind: JsTokenKind
  /** Identifier text, decoded string value, raw template chunk, or the punctuation itself. */
  value: string
  start: number
  end: number
  /** `{}` nesting outside the token; both braces of a pair carry the outer depth. */
  depth: number
  /** A line break (possibly inside a comment) separates this token from the previous one. */
  newlineBefore: boolean
  /** First token of a column-0 declaration line, where brace depth was reset to 0. */
  lineResync: boolean
}

// Longest first; `>>` is left out so nested generics close one `>` at a time.
const MULTI_CHAR_PUNCTUATION =
  '=== !== **= ... &&= ||= ??= => == != <= >= && || ?? ?. += -= *= %= &= |= ^= ++ -- **'.split(' ')

const KEYWORDS_BEFORE_EXPRESSION = new Set(
  'return typeof instanceof in of new delete void throw case do else yield await extends'.split(' ')
)

// Why: a mis-lexed TSX apostrophe or regex must not shift brace depth for the rest of the file.
const RESYNC_LINE =
  /(?:import|export|function|class|const|let|var|type|interface|enum|declare|abstract|async)(?=[\s{*(])|module\.exports(?![\w$])|exports\./y

const ESCAPES = new Map(Object.entries({ n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v' }))

function isIdentifierStart(code: number): boolean {
  return (
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122) ||
    code === 95 ||
    code === 36 ||
    (code >= 0x80 && !isExtraWhitespace(code))
  )
}

function isIdentifierPart(code: number): boolean {
  return isIdentifierStart(code) || (code >= 48 && code <= 57)
}

function isExtraWhitespace(code: number): boolean {
  return code === 0xa0 || code === 0xfeff || code === 0x2028 || code === 0x2029
}

function isLineBreak(code: number): boolean {
  return code === 10 || code === 13
}

function isDigit(code: number): boolean {
  return code >= 48 && code <= 57
}

/** Tolerant TS/TSX/JS/JSX tokenizer: comments are dropped, strings/templates/regexes become tokens. */
export function lexJsSource(text: string): JsToken[] {
  const tokens: JsToken[] = []
  // true marks a template `${` so its `}` resumes the template instead of closing a block.
  const braceStack: boolean[] = []
  const length = text.length
  let openTemplates = 0
  let depth = 0
  let newlineBefore = false
  let lineResync = false
  let atLineStart = true
  let regexAllowed = true
  let pos = text.startsWith('#!') ? lineEnd(text, 0) : 0

  const push = (kind: JsTokenKind, value: string, start: number, end: number, d = depth): void => {
    tokens.push({ kind, value, start, end, depth: d, newlineBefore, lineResync })
    newlineBefore = false
    lineResync = false
  }

  const scanTemplateChunk = (start: number, contentStart: number): void => {
    let p = contentStart
    let opensSubstitution = false
    while (p < length) {
      const ch = text[p]
      if (ch === '\\') {
        p += 2
        continue
      }
      if (ch === '`') {
        p++
        break
      }
      if (ch === '$' && text[p + 1] === '{') {
        p += 2
        opensSubstitution = true
        break
      }
      p++
    }
    p = Math.min(p, length)
    push('template', text.slice(start, p), start, p)
    if (opensSubstitution) {
      braceStack.push(true)
      openTemplates++
      depth++
    }
    regexAllowed = opensSubstitution
    pos = p
  }

  while (pos < length) {
    const code = text.charCodeAt(pos)
    if (isLineBreak(code)) {
      newlineBefore = true
      atLineStart = true
      pos++
      continue
    }
    if (atLineStart) {
      atLineStart = false
      RESYNC_LINE.lastIndex = pos
      if (openTemplates === 0 && RESYNC_LINE.test(text)) {
        depth = 0
        braceStack.length = 0
        lineResync = true
        regexAllowed = true
      }
    }
    if (code === 32 || code === 9 || code === 11 || code === 12 || isExtraWhitespace(code)) {
      pos++
      continue
    }
    const ch = text[pos]
    const next = text[pos + 1]
    if (ch === '/' && next === '/') {
      pos = lineEnd(text, pos)
      continue
    }
    if (ch === '/' && next === '*') {
      const close = text.indexOf('*/', pos + 2)
      const end = close === -1 ? length : close + 2
      if (/[\r\n]/.test(text.slice(pos, end))) {
        newlineBefore = true
      }
      pos = end
      continue
    }
    const start = pos
    if (isIdentifierStart(code)) {
      pos++
      while (pos < length && isIdentifierPart(text.charCodeAt(pos))) {
        pos++
      }
      const name = text.slice(start, pos)
      push('identifier', name, start, pos)
      regexAllowed = KEYWORDS_BEFORE_EXPRESSION.has(name)
      continue
    }
    if (isDigit(code) || (ch === '.' && isDigit(text.charCodeAt(pos + 1)))) {
      pos = scanNumber(text, pos)
      push('number', text.slice(start, pos), start, pos)
      regexAllowed = false
      continue
    }
    if (ch === '"' || ch === "'") {
      const { end, value } = scanString(text, pos)
      pos = end
      push('string', value, start, end)
      regexAllowed = false
      continue
    }
    if (ch === '`') {
      scanTemplateChunk(start, pos + 1)
      continue
    }
    if (ch === '/' && regexAllowed && !followsJsxOpenAngle(tokens, start)) {
      const end = scanRegex(text, pos)
      if (end !== null) {
        pos = end
        push('regex', text.slice(start, end), start, end)
        regexAllowed = false
        continue
      }
    }
    if (ch === '{') {
      push('punctuation', '{', start, start + 1)
      braceStack.push(false)
      depth++
      pos++
      regexAllowed = true
      continue
    }
    if (ch === '}') {
      if (braceStack.pop() === true) {
        openTemplates--
        depth--
        scanTemplateChunk(start, pos + 1)
        continue
      }
      depth = Math.max(0, depth - 1)
      push('punctuation', '}', start, start + 1)
      pos++
      regexAllowed = true
      continue
    }
    const punctuation = readPunctuation(text, pos)
    pos += punctuation.length
    push('punctuation', punctuation, start, pos)
    regexAllowed = !(
      punctuation === ')' ||
      punctuation === ']' ||
      punctuation === '++' ||
      punctuation === '--'
    )
  }
  return tokens
}

function lineEnd(text: string, from: number): number {
  let p = from
  while (p < text.length && !isLineBreak(text.charCodeAt(p))) {
    p++
  }
  return p
}

// Why: `</` is a JSX closing tag, never `<` followed by a regex.
function followsJsxOpenAngle(tokens: readonly JsToken[], slashOffset: number): boolean {
  const previous = tokens.at(-1)
  return previous?.kind === 'punctuation' && previous.value === '<' && previous.end === slashOffset
}

function readPunctuation(text: string, pos: number): string {
  for (const candidate of MULTI_CHAR_PUNCTUATION) {
    if (text.startsWith(candidate, pos)) {
      // `a?.5:b` is a conditional, not optional chaining.
      if (candidate === '?.' && isDigit(text.charCodeAt(pos + 2))) {
        continue
      }
      return candidate
    }
  }
  return text[pos]
}

function scanNumber(text: string, start: number): number {
  let p = start
  const isHex = /^0[xXbBoO]/.test(text.slice(start, start + 2))
  while (p < text.length) {
    const ch = text[p]
    if (/[\w$.]/.test(ch)) {
      p++
    } else if ((ch === '+' || ch === '-') && !isHex && /[eE]/.test(text[p - 1])) {
      p++
    } else {
      break
    }
  }
  return p
}

/** A string also stops at a line break, so a stray JSX apostrophe damages at most one line. */
function scanString(text: string, start: number): { end: number; value: string } {
  const quote = text[start]
  let value = ''
  let p = start + 1
  while (p < text.length) {
    const ch = text[p]
    if (ch === quote) {
      return { end: p + 1, value }
    }
    if (isLineBreak(text.charCodeAt(p))) {
      return { end: p, value }
    }
    if (ch === '\\') {
      const escaped = text[p + 1] ?? ''
      if (escaped === '\r' && text[p + 2] === '\n') {
        p += 3
        continue
      }
      value += isLineBreak(escaped.charCodeAt(0)) ? '' : (ESCAPES.get(escaped) ?? escaped)
      p += 2
      continue
    }
    value += ch
    p++
  }
  return { end: text.length, value }
}

/** End offset of a regex literal at `start`, or null when it does not close on its line. */
function scanRegex(text: string, start: number): number | null {
  let p = start + 1
  let inClass = false
  while (p < text.length) {
    const code = text.charCodeAt(p)
    if (isLineBreak(code)) {
      return null
    }
    const ch = text[p]
    if (ch === '\\') {
      if (isLineBreak(text.charCodeAt(p + 1))) {
        return null
      }
      p += 2
      continue
    }
    if (inClass) {
      inClass = ch !== ']'
    } else if (ch === '[') {
      inClass = true
    } else if (ch === '/') {
      p++
      while (p < text.length && isIdentifierPart(text.charCodeAt(p))) {
        p++
      }
      return p
    }
    p++
  }
  return null
}
