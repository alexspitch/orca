import type { CodeRange } from './code-navigation-types'
import type { JsImportBinding, JsModuleSyntax } from './js-module-syntax'
import type { JsToken } from './js-source-lexer'
import {
  followsMemberAccess,
  isName,
  isPunct,
  isString,
  matchingClose,
  tokenRange,
  tokensRange,
  type JsPatternEntry,
  type JsTokenCursor
} from './js-token-cursor'

export type JsSyntaxBuilder = JsTokenCursor & {
  readonly syntax: JsModuleSyntax
  /** Start offsets already in `syntax.specifiers`. */
  readonly specifierStarts: Set<number>
}

export type JsNamedSpecifier = { name: JsToken; alias: JsToken | null }

// Why: kept off the public binding type so its shape stays exactly what consumers expect.
const importedNameRanges = new WeakMap<JsImportBinding, CodeRange>()

export function importedNameRangeOf(binding: JsImportBinding): CodeRange | undefined {
  return importedNameRanges.get(binding)
}

/** Records the string literal at `index` as a module specifier and returns its value. */
export function addSpecifier(builder: JsSyntaxBuilder, index: number): string {
  const token = builder.tokens[index]
  if (!builder.specifierStarts.has(token.start)) {
    builder.specifierStarts.add(token.start)
    builder.syntax.specifiers.push({ specifier: token.value, range: tokenRange(builder, token) })
  }
  return token.value
}

function addBinding(
  builder: JsSyntaxBuilder,
  binding: { local: JsToken; importedName: string; importedToken: JsToken; specifier: string },
  statementRange: CodeRange
): void {
  const entry: JsImportBinding = {
    localName: binding.local.value,
    importedName: binding.importedName,
    specifier: binding.specifier,
    localRange: tokenRange(builder, binding.local),
    statementRange
  }
  importedNameRanges.set(entry, tokenRange(builder, binding.importedToken))
  builder.syntax.imports.push(entry)
}

/** `{ a, b as c, type T, default as d, "x" as y }` of an import or export clause. */
export function readNamedSpecifiers(
  cursor: JsTokenCursor,
  open: number
): { entries: JsNamedSpecifier[]; next: number } {
  const close = matchingClose(cursor, open)
  if (close === -1) {
    return { entries: [], next: cursor.tokens.length }
  }
  const entries: JsNamedSpecifier[] = []
  const isNameLike = (index: number): boolean => isName(cursor, index) || isString(cursor, index)
  let i = open + 1
  while (i < close) {
    if (isName(cursor, i, 'type') && isNameLike(i + 1) && !isName(cursor, i + 1, 'as')) {
      i++
    }
    if (!isNameLike(i)) {
      i++
      continue
    }
    const name = cursor.tokens[i]
    if (isName(cursor, i + 1, 'as') && isNameLike(i + 2)) {
      entries.push({ name, alias: cursor.tokens[i + 2] })
      i += 3
    } else {
      entries.push({ name, alias: null })
      i++
    }
  }
  return { entries, next: close + 1 }
}

function isTypeOnlyModifier(cursor: JsTokenCursor, index: number): boolean {
  if (!isName(cursor, index, 'type') && !isName(cursor, index, 'typeof')) {
    return false
  }
  if (isPunct(cursor, index + 1, '{') || isPunct(cursor, index + 1, '*')) {
    return true
  }
  // `import type from './x'` binds a default named `type`.
  return (
    isName(cursor, index + 1) && !(isName(cursor, index + 1, 'from') && isString(cursor, index + 2))
  )
}

/** Last index of a statement ending at `last`, absorbing a directly following `;`. */
function withSemicolon(cursor: JsTokenCursor, last: number): number {
  return isPunct(cursor, last + 1, ';') ? last + 1 : last
}

/** ESM `import` declarations and `import x = require('x')`; returns the index past it. */
export function readImportStatement(builder: JsSyntaxBuilder, index: number): number | null {
  if (
    !isName(builder, index, 'import') ||
    followsMemberAccess(builder, index) ||
    isPunct(builder, index + 1, '(') ||
    isPunct(builder, index + 1, '.')
  ) {
    return null
  }
  let i = isTypeOnlyModifier(builder, index + 1) ? index + 2 : index + 1
  if (isString(builder, i)) {
    addSpecifier(builder, i)
    return withSemicolon(builder, i) + 1
  }
  if (isName(builder, i) && isPunct(builder, i + 1, '=')) {
    const require = requireCallAt(builder, i + 2)
    if (!require) {
      return i + 2
    }
    const local = builder.tokens[i]
    const specifier = addSpecifier(builder, require.specifierIndex)
    const last = withSemicolon(builder, require.end - 1)
    const binding = { local, importedName: '*', importedToken: local, specifier }
    addBinding(builder, binding, tokensRange(builder, index, last))
    return last + 1
  }
  const pending: { local: JsToken; importedName: string; importedToken: JsToken }[] = []
  if (isName(builder, i) && !isName(builder, i, 'from')) {
    const local = builder.tokens[i]
    pending.push({ local, importedName: 'default', importedToken: local })
    i += isPunct(builder, i + 1, ',') ? 2 : 1
  }
  if (isPunct(builder, i, '*') && isName(builder, i + 1, 'as') && isName(builder, i + 2)) {
    pending.push({
      local: builder.tokens[i + 2],
      importedName: '*',
      importedToken: builder.tokens[i]
    })
    i += 3
  } else if (isPunct(builder, i, '{')) {
    const named = readNamedSpecifiers(builder, i)
    for (const { name, alias } of named.entries) {
      const local = alias ?? name
      if (local.kind === 'identifier') {
        pending.push({ local, importedName: name.value, importedToken: name })
      }
    }
    i = named.next
  }
  if (!isName(builder, i, 'from') || !isString(builder, i + 1)) {
    return i
  }
  const specifier = addSpecifier(builder, i + 1)
  const statementRange = tokensRange(builder, index, withSemicolon(builder, i + 1))
  for (const binding of pending) {
    addBinding(builder, { ...binding, specifier }, statementRange)
  }
  return withSemicolon(builder, i + 1) + 1
}

/** `require('x')` (optionally `.member`) at `start`, with the index past it. */
export function requireCallAt(
  cursor: JsTokenCursor,
  start: number
): { specifierIndex: number; member: JsToken | null; end: number } | null {
  if (
    !isName(cursor, start, 'require') ||
    !isPunct(cursor, start + 1, '(') ||
    !isString(cursor, start + 2) ||
    !isPunct(cursor, start + 3, ')')
  ) {
    return null
  }
  if (isPunct(cursor, start + 4, '.') && isName(cursor, start + 5)) {
    return { specifierIndex: start + 2, member: cursor.tokens[start + 5], end: start + 6 }
  }
  return { specifierIndex: start + 2, member: null, end: start + 4 }
}

/**
 * Records `const x = require('x')` / `const { a, b: c } = require('x')` bindings; returns
 * false when the initializer is not exactly a require call.
 */
export function recordRequireDeclarator(
  builder: JsSyntaxBuilder,
  declarator: {
    bindings: JsPatternEntry[]
    isPattern: boolean
    initStart: number
    initEnd: number
  },
  statementStart: number
): boolean {
  const require = declarator.initStart === -1 ? null : requireCallAt(builder, declarator.initStart)
  if (!require || require.end !== declarator.initEnd || (declarator.isPattern && require.member)) {
    return false
  }
  const specifier = addSpecifier(builder, require.specifierIndex)
  const statementRange = tokensRange(
    builder,
    statementStart,
    withSemicolon(builder, require.end - 1)
  )
  for (const { key, local } of declarator.bindings) {
    if (!declarator.isPattern) {
      const importedName = require.member?.value ?? '*'
      addBinding(builder, { local, importedName, importedToken: local, specifier }, statementRange)
    } else if (key) {
      addBinding(
        builder,
        { local, importedName: key.value, importedToken: key, specifier },
        statementRange
      )
    }
  }
  return true
}

/** Dynamic `import('x')` and `require('x')` anywhere in the file. */
export function collectDynamicSpecifiers(builder: JsSyntaxBuilder): void {
  const { tokens } = builder
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    if (
      token.kind === 'identifier' &&
      (token.value === 'import' || token.value === 'require') &&
      !followsMemberAccess(builder, i) &&
      isPunct(builder, i + 1, '(') &&
      isString(builder, i + 2) &&
      (isPunct(builder, i + 3, ')') || isPunct(builder, i + 3, ','))
    ) {
      addSpecifier(builder, i + 2)
    }
  }
}
