import type {
  PythonBinding,
  PythonBindingKind,
  PythonImportSource,
  PythonStatementFacts
} from './python-binding-types'

export type PythonToken = {
  text: string
  start: number
  end: number
  kind: 'name' | 'number' | 'op'
}

const THREE_CHAR_OPERATORS = new Set(['**=', '//=', '>>=', '<<=', '...'])
const TWO_CHAR_OPERATORS = new Set(
  '** // >> << <= >= == != -> := += -= *= /= %= &= |= ^= @='.split(' ')
)
export const AUGMENTED_OPERATORS: ReadonlySet<string> = new Set(
  '+= -= *= /= //= %= **= >>= <<= &= |= ^= @='.split(' ')
)
const PYTHON_KEYWORDS: ReadonlySet<string> = new Set(
  (
    'False None True and as assert async await break class continue def del elif else except ' +
    'finally for from global if import in is lambda nonlocal not or pass raise return try while ' +
    'with yield'
  ).split(' ')
)

export function isPythonKeyword(name: string): boolean {
  return PYTHON_KEYWORDS.has(name)
}

function isDigit(ch: number): boolean {
  return ch >= 48 && ch <= 57
}

function isNameStart(ch: number): boolean {
  return (
    (ch >= 65 && ch <= 90) || (ch >= 97 && ch <= 122) || ch === 95 || (ch >= 128 && ch !== 0xfeff)
  )
}

function isNamePart(ch: number): boolean {
  return isNameStart(ch) || isDigit(ch)
}

/** Tokens of a blanked code view (strings and comments are already spaces). */
export function tokenizePython(code: string, start: number, end: number): PythonToken[] {
  const tokens: PythonToken[] = []
  let i = start
  while (i < end) {
    const ch = code.charCodeAt(i)
    if (ch <= 32 || ch === 92 || ch === 0xfeff) {
      i++
      continue
    }
    if (isNameStart(ch) || isDigit(ch) || (ch === 46 && isDigit(code.charCodeAt(i + 1)))) {
      let j = i + 1
      while (j < end && (isNamePart(code.charCodeAt(j)) || (!isNameStart(ch) && code[j] === '.'))) {
        j++
      }
      tokens.push({
        text: code.slice(i, j),
        start: i,
        end: j,
        kind: isNameStart(ch) ? 'name' : 'number'
      })
      i = j
      continue
    }
    let length = 1
    if (THREE_CHAR_OPERATORS.has(code.slice(i, i + 3)) && i + 3 <= end) {
      length = 3
    } else if (TWO_CHAR_OPERATORS.has(code.slice(i, i + 2)) && i + 2 <= end) {
      length = 2
    }
    tokens.push({ text: code.slice(i, i + length), start: i, end: i + length, kind: 'op' })
    i += length
  }
  return tokens
}

function isOpener(token: PythonToken): boolean {
  return token.kind === 'op' && (token.text === '(' || token.text === '[' || token.text === '{')
}

function isCloser(token: PythonToken): boolean {
  return token.kind === 'op' && (token.text === ')' || token.text === ']' || token.text === '}')
}

/** Index of the bracket closing `tokens[openIndex]`, or `tokens.length` when unclosed. */
export function closingIndex(tokens: readonly PythonToken[], openIndex: number): number {
  let depth = 0
  for (let k = openIndex; k < tokens.length; k++) {
    if (isOpener(tokens[k])) {
      depth++
    } else if (isCloser(tokens[k])) {
      depth--
      if (depth === 0) {
        return k
      }
    }
  }
  return tokens.length
}

/** First index in [from, to) at bracket depth 0 (relative to `from`) matching `predicate`, else -1. */
export function findTopLevel(
  tokens: readonly PythonToken[],
  from: number,
  to: number,
  predicate: (token: PythonToken) => boolean
): number {
  let depth = 0
  for (let k = from; k < to; k++) {
    const token = tokens[k]
    if (depth === 0 && predicate(token)) {
      return k
    }
    if (isOpener(token)) {
      depth++
    } else if (isCloser(token)) {
      depth = Math.max(0, depth - 1)
    }
  }
  return -1
}

/** Non-empty [start, end) index ranges of [from, to) split on a top-level separator. */
export function splitTopLevel(
  tokens: readonly PythonToken[],
  from: number,
  to: number,
  separator: string
): [number, number][] {
  const ranges: [number, number][] = []
  let segmentStart = from
  while (segmentStart < to) {
    const found = findTopLevel(tokens, segmentStart, to, (token) => token.text === separator)
    const segmentEnd = found === -1 ? to : found
    if (segmentEnd > segmentStart) {
      ranges.push([segmentStart, segmentEnd])
    }
    segmentStart = segmentEnd + 1
  }
  return ranges
}

/** The header colon at depth 0, skipping the colons that end `lambda` parameter lists. */
export function headerColonIndex(tokens: readonly PythonToken[], from: number): number {
  let pendingLambdas = 0
  const found = findTopLevel(tokens, from, tokens.length, (token) => {
    if (token.text === 'lambda') {
      pendingLambdas++
    } else if (token.text === ':') {
      if (pendingLambdas === 0) {
        return true
      }
      pendingLambdas--
    }
    return false
  })
  return found
}

export function makeBinding(
  token: PythonToken,
  kind: PythonBindingKind,
  line: number,
  importSource: PythonImportSource | null = null
): PythonBinding {
  return { name: token.text, offset: token.start, kind, line, importSource }
}

function isBindableName(token: PythonToken | undefined): token is PythonToken {
  return token !== undefined && token.kind === 'name' && !isPythonKeyword(token.text)
}

/** Assignment-target list: names, `*rest`, nested tuples/lists, and `recv.attr` attributes. */
export function collectTargets(
  tokens: readonly PythonToken[],
  from: number,
  to: number,
  facts: PythonStatementFacts,
  kind: PythonBindingKind,
  line: number
): void {
  for (const [start, end] of splitTopLevel(tokens, from, to, ',')) {
    const k = tokens[start].text === '*' ? start + 1 : start
    const token = tokens[k]
    if (k >= end) {
      continue
    }
    if ((token.text === '(' || token.text === '[') && closingIndex(tokens, k) === end - 1) {
      collectTargets(tokens, k + 1, end - 1, facts, kind, line)
    } else if (isBindableName(token) && end - k === 1) {
      facts.bindings.push(makeBinding(token, kind, line))
    } else if (
      isBindableName(token) &&
      end - k === 3 &&
      tokens[k + 1].text === '.' &&
      isBindableName(tokens[k + 2])
    ) {
      facts.attributes.push({
        receiver: token.text,
        binding: makeBinding(tokens[k + 2], kind, line)
      })
    }
  }
}

export function collectWalrusTargets(
  tokens: readonly PythonToken[],
  from: number,
  to: number,
  facts: PythonStatementFacts,
  line: number
): void {
  for (let k = from + 1; k < to; k++) {
    if (tokens[k].text === ':=' && isBindableName(tokens[k - 1])) {
      facts.bindings.push(makeBinding(tokens[k - 1], 'target', line))
    }
  }
}

/** Names of a parameter list (`def`, `lambda`, type parameters), skipping `*`, `/` and defaults. */
export function collectParameterNames(
  tokens: readonly PythonToken[],
  from: number,
  to: number,
  out: PythonBinding[],
  line: number
): void {
  for (const [start, end] of splitTopLevel(tokens, from, to, ',')) {
    let k = start
    while (k < end && (tokens[k].text === '*' || tokens[k].text === '**')) {
      k++
    }
    if (k < end && isBindableName(tokens[k])) {
      out.push(makeBinding(tokens[k], 'parameter', line))
    }
  }
}
