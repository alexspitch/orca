import {
  emptyStatementFacts,
  type PythonBaseReference,
  type PythonBinding,
  type PythonStatementFacts
} from './python-binding-types'
import { collectHeaderTargets } from './python-clause-targets'
import { parseFromImportStatement, parseImportStatement } from './python-import-statements'
import {
  AUGMENTED_OPERATORS,
  closingIndex,
  collectParameterNames,
  collectTargets,
  collectWalrusTargets,
  findTopLevel,
  headerColonIndex,
  makeBinding,
  splitTopLevel,
  tokenizePython,
  type PythonToken
} from './python-statement-tokens'

export type PythonDefinitionHeader = {
  kind: 'def' | 'class'
  binding: PythonBinding
  /** Just past the header colon, or the line end when it has none. */
  bodyOffset: number
  parameters: PythonBinding[]
  bases: PythonBaseReference[]
  /** Simple statements after the colon on the same line. */
  inlineBody: PythonStatementFacts | null
}

export type PythonLineParse = {
  /** Facts for the scope the line sits in; a definition's own name is among them. */
  facts: PythonStatementFacts
  isDecorator: boolean
  definition: PythonDefinitionHeader | null
  /** The header ends with its colon, so an indented block follows. */
  opensBlock: boolean
}

const BLOCK_KEYWORDS = new Set([
  'if',
  'elif',
  'else',
  'while',
  'for',
  'try',
  'except',
  'finally',
  'with'
])
const SOFT_BLOCK_KEYWORDS = new Set(['match', 'case'])
const NOT_AFTER_SOFT_KEYWORD = new Set(['=', '.', ':', ',', ';', ')', ']', '}', ':=', '==', '!='])

function isSoftBlockStart(tokens: readonly PythonToken[]): boolean {
  const next = tokens[1]
  return (
    SOFT_BLOCK_KEYWORDS.has(tokens[0].text) &&
    next !== undefined &&
    !NOT_AFTER_SOFT_KEYWORD.has(next.text) &&
    !AUGMENTED_OPERATORS.has(next.text) &&
    headerColonIndex(tokens, 1) !== -1
  )
}

/** One logical line of blanked code (see `scanPythonSource`). */
export function parsePythonLine(
  code: string,
  start: number,
  end: number,
  line: number
): PythonLineParse {
  const tokens = tokenizePython(code, start, end)
  const facts = emptyStatementFacts()
  const result: PythonLineParse = { facts, isDecorator: false, definition: null, opensBlock: false }
  if (tokens.length === 0) {
    return result
  }
  if (tokens[0].text === '@') {
    collectWalrusTargets(tokens, 0, tokens.length, facts, line)
    result.isDecorator = true
    return result
  }
  const isAsync = tokens[0].text === 'async' && ['def', 'for', 'with'].includes(tokens[1]?.text)
  const k = isAsync ? 1 : 0
  const keyword = tokens[k].text
  if ((keyword === 'def' || keyword === 'class') && tokens[k + 1]?.kind === 'name') {
    parseDefinition(tokens, k, result, line)
    return result
  }
  if (BLOCK_KEYWORDS.has(keyword) || isSoftBlockStart(tokens)) {
    const colon = headerColonIndex(tokens, k + 1)
    collectHeaderTargets(keyword, tokens, k + 1, colon === -1 ? tokens.length : colon, facts, line)
    if (colon !== -1) {
      parseSimpleStatements(tokens, colon + 1, tokens.length, facts, line)
    }
    result.opensBlock = colon === tokens.length - 1
    return result
  }
  parseSimpleStatements(tokens, 0, tokens.length, facts, line)
  return result
}

function parseDefinition(
  tokens: readonly PythonToken[],
  k: number,
  result: PythonLineParse,
  line: number
): void {
  const kind = tokens[k].text === 'def' ? 'def' : 'class'
  const binding = makeBinding(tokens[k + 1], kind, line)
  result.facts.bindings.push(binding)
  const parameters: PythonBinding[] = []
  const bases: PythonBaseReference[] = []
  let p = k + 2
  if (tokens[p]?.text === '[') {
    const close = closingIndex(tokens, p)
    collectParameterNames(tokens, p + 1, close, parameters, line)
    p = close + 1
  }
  if (tokens[p]?.text === '(') {
    const close = closingIndex(tokens, p)
    if (kind === 'def') {
      collectParameterNames(tokens, p + 1, close, parameters, line)
    } else {
      collectBases(tokens, p + 1, close, bases)
    }
    p = close + 1
  }
  const colon = p < tokens.length ? headerColonIndex(tokens, p) : -1
  let inlineBody: PythonStatementFacts | null = null
  if (colon !== -1 && colon < tokens.length - 1) {
    inlineBody = emptyStatementFacts()
    parseSimpleStatements(tokens, colon + 1, tokens.length, inlineBody, line)
  }
  result.definition = {
    kind,
    binding,
    bodyOffset: colon === -1 ? (tokens.at(-1)?.end ?? binding.offset) : tokens[colon].end,
    parameters,
    bases,
    inlineBody
  }
  result.opensBlock = colon === tokens.length - 1
}

/** Dotted base-class names; keyword arguments, `*args` and calls are skipped. */
function collectBases(
  tokens: readonly PythonToken[],
  from: number,
  to: number,
  out: PythonBaseReference[]
): void {
  for (const [start, end] of splitTopLevel(tokens, from, to, ',')) {
    if (tokens[start].kind !== 'name' || tokens[start + 1]?.text === '=') {
      continue
    }
    const parts: string[] = []
    let k = start
    while (k < end && tokens[k].kind === 'name') {
      parts.push(tokens[k].text)
      k++
      if (k + 1 < end && tokens[k].text === '.') {
        k++
      } else {
        break
      }
    }
    if (k === end || tokens[k].text === '[') {
      out.push({ parts, offset: tokens[start].start })
    }
  }
}

function parseSimpleStatements(
  tokens: readonly PythonToken[],
  from: number,
  to: number,
  facts: PythonStatementFacts,
  line: number
): void {
  for (const [start, end] of splitTopLevel(tokens, from, to, ';')) {
    parseSimpleStatement(tokens, start, end, facts, line)
  }
}

function parseSimpleStatement(
  tokens: readonly PythonToken[],
  s: number,
  e: number,
  facts: PythonStatementFacts,
  line: number
): void {
  const first = tokens[s].text
  if (first === 'import') {
    parseImportStatement(tokens, s, e, facts, line)
    return
  }
  if (first === 'from') {
    parseFromImportStatement(tokens, s, e, facts, line)
    return
  }
  if (first === 'global' || first === 'nonlocal') {
    const names = first === 'global' ? facts.globals : facts.nonlocals
    for (let k = s + 1; k < e; k++) {
      if (tokens[k].kind === 'name') {
        names.push(tokens[k].text)
      }
    }
    return
  }
  if (
    first === 'type' &&
    tokens[s + 1]?.kind === 'name' &&
    ['=', '['].includes(tokens[s + 2]?.text)
  ) {
    facts.bindings.push(makeBinding(tokens[s + 1], 'typeAlias', line))
    return
  }
  collectWalrusTargets(tokens, s, e, facts, line)
  // Why: a lambda's `x=1: ...` defaults and colon belong to the right-hand side.
  const lambda = findTopLevel(tokens, s, e, (token) => token.text === 'lambda')
  const scanEnd = lambda === -1 ? e : lambda
  const equals: number[] = []
  for (const [, segmentEnd] of splitTopLevel(tokens, s, scanEnd, '=')) {
    if (segmentEnd < scanEnd && tokens[segmentEnd].text === '=') {
      equals.push(segmentEnd)
    }
  }
  const annotation = findTopLevel(tokens, s, equals[0] ?? scanEnd, (token) => token.text === ':')
  if (annotation !== -1) {
    collectTargets(tokens, s, annotation, facts, 'assignment', line)
    return
  }
  if (equals.length > 0) {
    let segmentStart = s
    for (const equalsIndex of equals) {
      collectTargets(tokens, segmentStart, equalsIndex, facts, 'assignment', line)
      segmentStart = equalsIndex + 1
    }
    return
  }
  const augmented = findTopLevel(tokens, s, scanEnd, (token) => AUGMENTED_OPERATORS.has(token.text))
  if (augmented !== -1) {
    collectTargets(tokens, s, augmented, facts, 'augmented', line)
  }
}
