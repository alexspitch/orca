import type { CodeSymbolKind } from './code-navigation-types'
import { recordRequireDeclarator, type JsSyntaxBuilder } from './js-import-syntax'
import type { JsToken } from './js-source-lexer'
import {
  isName,
  isPunct,
  readBindingPattern,
  skipExpression,
  tokenRange,
  type JsPatternEntry,
  type JsTokenCursor
} from './js-token-cursor'

export type JsDeclarator = {
  bindings: JsPatternEntry[]
  /** The target was a destructuring pattern rather than one identifier. */
  isPattern: boolean
  /** Index of the initializer's first token, or -1. */
  initStart: number
  /** Index past the initializer (or the target when there is none). */
  initEnd: number
}

export type JsDeclarationStatement =
  | { kind: 'named'; name: JsToken; symbolKind: CodeSymbolKind; next: number }
  | { kind: 'variables'; isConst: boolean; declarators: JsDeclarator[]; next: number }

const NON_CLASS_NAMES = new Set(['extends', 'implements'])
const CONSTANT_NAME = /^[A-Z][A-Z0-9_]+$/

function named(
  cursor: JsTokenCursor,
  nameIndex: number,
  symbolKind: CodeSymbolKind
): JsDeclarationStatement {
  return { kind: 'named', name: cursor.tokens[nameIndex], symbolKind, next: nameIndex + 1 }
}

/** A declaration statement starting at `index` (modifiers like `declare`/`async` included). */
export function readDeclarationStatement(
  cursor: JsTokenCursor,
  index: number
): JsDeclarationStatement | null {
  let i = index
  while ((isName(cursor, i, 'declare') || isName(cursor, i, 'abstract')) && isName(cursor, i + 1)) {
    i++
  }
  if (isName(cursor, i, 'async') && isName(cursor, i + 1, 'function')) {
    i++
  }
  const keyword = cursor.tokens[i]
  if (keyword?.kind !== 'identifier') {
    return null
  }
  switch (keyword.value) {
    case 'function': {
      const nameIndex = isPunct(cursor, i + 1, '*') ? i + 2 : i + 1
      return isName(cursor, nameIndex) ? named(cursor, nameIndex, 'function') : null
    }
    case 'class':
      return isName(cursor, i + 1) && !NON_CLASS_NAMES.has(cursor.tokens[i + 1].value)
        ? named(cursor, i + 1, 'class')
        : null
    case 'interface':
      return isName(cursor, i + 1) ? named(cursor, i + 1, 'interface') : null
    case 'type':
      return isName(cursor, i + 1) && (isPunct(cursor, i + 2, '=') || isPunct(cursor, i + 2, '<'))
        ? named(cursor, i + 1, 'type')
        : null
    case 'enum':
      return isName(cursor, i + 1) ? named(cursor, i + 1, 'enum') : null
    case 'namespace':
    case 'module':
      return isName(cursor, i + 1) && (isPunct(cursor, i + 2, '{') || isPunct(cursor, i + 2, '.'))
        ? named(cursor, i + 1, 'namespace')
        : null
    case 'const':
      if (isName(cursor, i + 1, 'enum') && isName(cursor, i + 2)) {
        return named(cursor, i + 2, 'enum')
      }
      return readVariables(cursor, i + 1, true)
    case 'let':
    case 'var':
      return readVariables(cursor, i + 1, false)
    default:
      return null
  }
}

function readVariables(
  cursor: JsTokenCursor,
  from: number,
  isConst: boolean
): JsDeclarationStatement | null {
  const declarators: JsDeclarator[] = []
  let i = from
  for (;;) {
    let bindings: JsPatternEntry[]
    const isPattern = isPunct(cursor, i, '{') || isPunct(cursor, i, '[')
    if (isPattern) {
      const pattern = readBindingPattern(cursor, i)
      bindings = pattern.entries
      i = pattern.next
    } else if (isName(cursor, i)) {
      bindings = [{ key: null, local: cursor.tokens[i] }]
      i++
    } else {
      break
    }
    if (isPunct(cursor, i, '!')) {
      i++
    }
    if (isPunct(cursor, i, ':')) {
      i = skipExpression(cursor, i + 1, true)
    }
    let initStart = -1
    if (isPunct(cursor, i, '=')) {
      initStart = i + 1
      i = skipExpression(cursor, i + 1)
    }
    declarators.push({ bindings, isPattern, initStart, initEnd: i })
    if (!isPunct(cursor, i, ',')) {
      break
    }
    i++
  }
  return declarators.length === 0 ? null : { kind: 'variables', isConst, declarators, next: i }
}

/**
 * Reads and records a top-level declaration (require declarators become import bindings);
 * returns every name it binds, for `export` to list.
 */
export function readTopLevelDeclaration(
  builder: JsSyntaxBuilder,
  index: number,
  statementStart = index
): { names: JsToken[]; next: number } | null {
  const statement = readDeclarationStatement(builder, index)
  if (!statement) {
    return null
  }
  const { declarations } = builder.syntax
  if (statement.kind === 'named') {
    const { name, symbolKind } = statement
    declarations.push({ name: name.value, kind: symbolKind, nameRange: tokenRange(builder, name) })
    return { names: [name], next: statement.next }
  }
  const names: JsToken[] = []
  for (const declarator of statement.declarators) {
    const locals = declarator.bindings.map((binding) => binding.local)
    names.push(...locals)
    if (recordRequireDeclarator(builder, declarator, statementStart)) {
      continue
    }
    for (const local of locals) {
      const kind = statement.isConst && CONSTANT_NAME.test(local.value) ? 'constant' : 'variable'
      declarations.push({ name: local.value, kind, nameRange: tokenRange(builder, local) })
    }
  }
  return { names, next: statement.next }
}
