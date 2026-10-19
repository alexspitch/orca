import {
  emptyStatementFacts,
  type PythonBinding,
  type PythonStatementFacts
} from './python-binding-types'
import {
  closingIndex,
  collectParameterNames,
  collectTargets,
  collectWalrusTargets,
  findTopLevel,
  isPythonKeyword,
  makeBinding,
  tokenizePython,
  type PythonToken
} from './python-statement-tokens'

/** Targets bound by a compound-statement header: `for`, `with`/`except ... as`, `case` captures. */
export function collectHeaderTargets(
  keyword: string,
  tokens: readonly PythonToken[],
  from: number,
  to: number,
  facts: PythonStatementFacts,
  line: number
): void {
  collectWalrusTargets(tokens, from, to, facts, line)
  if (keyword === 'for') {
    const inIndex = findTopLevel(tokens, from, to, (token) => token.text === 'in')
    if (inIndex !== -1) {
      collectTargets(tokens, from, inIndex, facts, 'target', line)
    }
  } else if (keyword === 'with' || keyword === 'except') {
    for (let k = from; k < to; k++) {
      if (tokens[k].text === 'as') {
        collectAsTarget(tokens, k + 1, to, facts, line)
      }
    }
  } else if (keyword === 'case') {
    const guard = findTopLevel(tokens, from, to, (token) => token.text === 'if')
    collectCaptures(tokens, from, guard === -1 ? to : guard, facts, line)
  }
}

function collectAsTarget(
  tokens: readonly PythonToken[],
  k: number,
  to: number,
  facts: PythonStatementFacts,
  line: number
): void {
  const first = tokens[k]
  if (k >= to || first === undefined) {
    return
  }
  if (first.text === '(' || first.text === '[') {
    collectTargets(tokens, k + 1, Math.min(closingIndex(tokens, k), to), facts, 'target', line)
    return
  }
  let end = k
  while (end < to && (tokens[end].kind === 'name' || tokens[end].text === '.')) {
    end++
  }
  collectTargets(tokens, k, end, facts, 'target', line)
}

/** `match` capture patterns: bare names that are not dotted values, class names or keywords. */
function collectCaptures(
  tokens: readonly PythonToken[],
  from: number,
  to: number,
  facts: PythonStatementFacts,
  line: number
): void {
  for (let k = from; k < to; k++) {
    const token = tokens[k]
    const next = tokens[k + 1]?.text
    if (
      token.kind === 'name' &&
      token.text !== '_' &&
      !isPythonKeyword(token.text) &&
      tokens[k - 1]?.text !== '.' &&
      next !== '.' &&
      next !== '(' &&
      next !== '='
    ) {
      facts.bindings.push(makeBinding(token, 'target', line))
    }
  }
}

/** Lambda parameters and comprehension targets on one logical line; their scopes are not modelled. */
export function parsePythonExpressionLocals(
  code: string,
  start: number,
  end: number,
  line: number
): PythonBinding[] {
  const tokens = tokenizePython(code, start, end)
  const parameters: PythonBinding[] = []
  const facts = emptyStatementFacts()
  let depth = 0
  for (let k = 0; k < tokens.length; k++) {
    const text = tokens[k].text
    if (text === 'lambda') {
      const colon = findTopLevel(tokens, k + 1, tokens.length, (token) => token.text === ':')
      collectParameterNames(tokens, k + 1, colon === -1 ? tokens.length : colon, parameters, line)
    } else if (text === 'for' && depth > 0) {
      const inIndex = findTopLevel(tokens, k + 1, tokens.length, (token) => token.text === 'in')
      if (inIndex !== -1) {
        collectTargets(tokens, k + 1, inIndex, facts, 'target', line)
      }
    } else if (text === '(' || text === '[' || text === '{') {
      depth++
    } else if (text === ')' || text === ']' || text === '}') {
      depth--
    }
  }
  return [...parameters, ...facts.bindings]
}
