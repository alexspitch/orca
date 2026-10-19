import type { CodeRange, CodeSymbolKind } from './code-navigation-types'
import { readTopLevelDeclaration } from './js-declaration-syntax'
import {
  addSpecifier,
  readNamedSpecifiers,
  requireCallAt,
  type JsSyntaxBuilder
} from './js-import-syntax'
import type { JsExportEntry } from './js-module-syntax'
import type { JsToken } from './js-source-lexer'
import {
  followsMemberAccess,
  isName,
  isPunct,
  isStatementEnd,
  isString,
  matchingClose,
  tokenRange,
  tokensRange
} from './js-token-cursor'

const DEFAULT_DECLARATION_KEYWORDS = new Set([
  'function',
  'async',
  'class',
  'abstract',
  'interface'
])
const OBJECT_MEMBER_MODIFIERS = new Set(['async', 'get', 'set'])

function addLocal(
  builder: JsSyntaxBuilder,
  exportedName: string,
  localName: string,
  nameRange: CodeRange
): void {
  builder.syntax.exports.push({ kind: 'local', exportedName, localName, nameRange })
}

/** A plain identifier that is the whole remaining expression, or null. */
function soleIdentifierAt(builder: JsSyntaxBuilder, index: number): JsToken | null {
  return isName(builder, index) && isStatementEnd(builder, index + 1) ? builder.tokens[index] : null
}

/** ESM `export` statements; returns the index past the part it consumed. */
export function readExportStatement(builder: JsSyntaxBuilder, index: number): number | null {
  if (!isName(builder, index, 'export') || followsMemberAccess(builder, index)) {
    return null
  }
  const i = index + 1
  if (isPunct(builder, i, '=')) {
    const ident = soleIdentifierAt(builder, i + 1)
    addLocal(
      builder,
      'default',
      ident?.value ?? '',
      tokenRange(builder, ident ?? builder.tokens[index])
    )
    return i + 1
  }
  if (isName(builder, i, 'default')) {
    return readExportDefault(builder, i)
  }
  const clause =
    isName(builder, i, 'type') && (isPunct(builder, i + 1, '{') || isPunct(builder, i + 1, '*'))
      ? i + 1
      : i
  if (isPunct(builder, clause, '*')) {
    return readExportStar(builder, clause)
  }
  if (isPunct(builder, clause, '{')) {
    return readExportClause(builder, clause)
  }
  const declaration = readTopLevelDeclaration(builder, i, index)
  if (!declaration) {
    return i
  }
  for (const name of declaration.names) {
    addLocal(builder, name.value, name.value, tokenRange(builder, name))
  }
  return declaration.next
}

function readExportDefault(builder: JsSyntaxBuilder, defaultIndex: number): number {
  const i = defaultIndex + 1
  const token = builder.tokens[i]
  if (token?.kind === 'identifier' && DEFAULT_DECLARATION_KEYWORDS.has(token.value)) {
    const declaration = readTopLevelDeclaration(builder, i)
    if (declaration) {
      const [name] = declaration.names
      addLocal(builder, 'default', name.value, tokenRange(builder, name))
      return declaration.next
    }
  }
  const ident = soleIdentifierAt(builder, i)
  if (ident) {
    addLocal(builder, 'default', ident.value, tokenRange(builder, ident))
    return i + 1
  }
  addLocal(builder, 'default', '', tokenRange(builder, builder.tokens[defaultIndex]))
  return i
}

function readExportStar(builder: JsSyntaxBuilder, starIndex: number): number {
  let i = starIndex + 1
  let alias: JsToken | null = null
  if (isName(builder, i, 'as') && (isName(builder, i + 1) || isString(builder, i + 1))) {
    alias = builder.tokens[i + 1]
    i += 2
  }
  if (!isName(builder, i, 'from') || !isString(builder, i + 1)) {
    return i
  }
  const specifier = addSpecifier(builder, i + 1)
  const entry: JsExportEntry = alias
    ? {
        kind: 'reexport',
        exportedName: alias.value,
        importedName: '*',
        specifier,
        nameRange: tokenRange(builder, alias)
      }
    : { kind: 'star', specifier }
  builder.syntax.exports.push(entry)
  return i + 2
}

function readExportClause(builder: JsSyntaxBuilder, open: number): number {
  const { entries, next } = readNamedSpecifiers(builder, open)
  const specifier =
    isName(builder, next, 'from') && isString(builder, next + 1)
      ? addSpecifier(builder, next + 1)
      : null
  for (const { name, alias } of entries) {
    const exported = alias ?? name
    const nameRange = tokenRange(builder, exported)
    builder.syntax.exports.push(
      specifier === null
        ? { kind: 'local', exportedName: exported.value, localName: name.value, nameRange }
        : {
            kind: 'reexport',
            exportedName: exported.value,
            importedName: name.value,
            specifier,
            nameRange
          }
    )
  }
  return specifier === null ? next : next + 2
}

function isVoidPlaceholder(builder: JsSyntaxBuilder, index: number): boolean {
  return (
    (isName(builder, index, 'void') && builder.tokens[index + 1]?.value === '0') ||
    (isName(builder, index, 'undefined') && isStatementEnd(builder, index + 1))
  )
}

function valueKind(builder: JsSyntaxBuilder, index: number): CodeSymbolKind {
  if (isName(builder, index, 'class')) {
    return 'class'
  }
  const isFunction =
    isName(builder, index, 'function') ||
    (isName(builder, index, 'async') && isName(builder, index + 1, 'function'))
  return isFunction ? 'function' : 'variable'
}

type ExportsTarget = { name: JsToken | null; valueIndex: number }

/** `module.exports =` (name null), `module.exports.x =` or `exports.x =` at `index`. */
function readExportsTarget(builder: JsSyntaxBuilder, index: number): ExportsTarget | null {
  const isModuleExports =
    isName(builder, index, 'module') &&
    isPunct(builder, index + 1, '.') &&
    isName(builder, index + 2, 'exports')
  if (
    !isModuleExports &&
    (!isName(builder, index, 'exports') || followsMemberAccess(builder, index))
  ) {
    return null
  }
  const exportsIndex = isModuleExports ? index + 2 : index
  if (isModuleExports && isPunct(builder, exportsIndex + 1, '=')) {
    return { name: null, valueIndex: exportsIndex + 2 }
  }
  const nameIndex = exportsIndex + 2
  return isPunct(builder, exportsIndex + 1, '.') &&
    isName(builder, nameIndex) &&
    isPunct(builder, nameIndex + 1, '=')
    ? { name: builder.tokens[nameIndex], valueIndex: nameIndex + 2 }
    : null
}

/** `module.exports = ...`, `module.exports.x = ...` and `exports.x = ...`, chains included. */
export function readCommonJsExport(builder: JsSyntaxBuilder, index: number): number | null {
  const names: JsToken[] = []
  let valueIndex = index
  for (;;) {
    const target = readExportsTarget(builder, valueIndex)
    if (!target || (target.name === null && names.length > 0)) {
      break
    }
    if (target.name === null) {
      return readModuleExportsAssignment(builder, valueIndex, target.valueIndex)
    }
    names.push(target.name)
    valueIndex = target.valueIndex
  }
  // Why: TS-compiled CJS predeclares `exports.a = exports.b = void 0` before the real assignments.
  if (names.length === 0 || isVoidPlaceholder(builder, valueIndex)) {
    return names.length === 0 ? null : valueIndex
  }
  const ident = soleIdentifierAt(builder, valueIndex)
  const kind = valueKind(builder, valueIndex)
  for (const name of names) {
    const nameRange = tokenRange(builder, name)
    addLocal(builder, name.value, ident?.value ?? '', nameRange)
    if (!ident) {
      builder.syntax.declarations.push({ name: name.value, kind, nameRange })
    }
  }
  return valueIndex
}

function readModuleExportsAssignment(
  builder: JsSyntaxBuilder,
  moduleIndex: number,
  valueIndex: number
): number {
  const headRange = tokensRange(builder, moduleIndex, moduleIndex + 2)
  const ident = soleIdentifierAt(builder, valueIndex)
  addLocal(builder, 'default', ident?.value ?? '', ident ? tokenRange(builder, ident) : headRange)
  const require = requireCallAt(builder, valueIndex)
  if (require && !require.member && isStatementEnd(builder, require.end)) {
    builder.syntax.exports.push({
      kind: 'star',
      specifier: addSpecifier(builder, require.specifierIndex)
    })
    return require.end
  }
  if (isPunct(builder, valueIndex, '{')) {
    readObjectLiteralExports(builder, valueIndex)
  }
  return valueIndex
}

function readObjectLiteralExports(builder: JsSyntaxBuilder, open: number): void {
  const close = matchingClose(builder, open)
  if (close === -1) {
    return
  }
  const atElementEnd = (index: number): boolean => index === close || isPunct(builder, index, ',')
  let i = open + 1
  while (i < close) {
    if (isPunct(builder, i, ',')) {
      i++
      continue
    }
    while (
      OBJECT_MEMBER_MODIFIERS.has(builder.tokens[i].value) &&
      builder.tokens[i].kind === 'identifier' &&
      !atElementEnd(i + 1) &&
      !isPunct(builder, i + 1, ':') &&
      !isPunct(builder, i + 1, '(')
    ) {
      i++
    }
    if (isPunct(builder, i, '*')) {
      i++
    }
    const key = builder.tokens[i]
    if (key.kind === 'identifier' || key.kind === 'string' || key.kind === 'number') {
      let localName = ''
      if (atElementEnd(i + 1)) {
        localName = key.kind === 'identifier' ? key.value : ''
      } else if (isPunct(builder, i + 1, ':') && isName(builder, i + 2) && atElementEnd(i + 3)) {
        localName = builder.tokens[i + 2].value
      }
      addLocal(builder, key.value, localName, tokenRange(builder, key))
    }
    while (i < close && !isPunct(builder, i, ',')) {
      const token = builder.tokens[i]
      const isOpener =
        token.kind === 'punctuation' &&
        (token.value === '(' || token.value === '[' || token.value === '{')
      const groupClose = isOpener ? matchingClose(builder, i) : -1
      i = groupClose === -1 ? i + 1 : groupClose + 1
    }
  }
}
