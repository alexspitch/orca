import type { CodePosition, CodeRange, CodeSymbolKind } from './code-navigation-types'
import { readTopLevelDeclaration } from './js-declaration-syntax'
import { readCommonJsExport, readExportStatement } from './js-export-syntax'
import {
  collectDynamicSpecifiers,
  importedNameRangeOf,
  readImportStatement,
  type JsSyntaxBuilder
} from './js-import-syntax'
import { lexJsSource } from './js-source-lexer'
import { isName, isPunct, isStatementStart, matchingClose } from './js-token-cursor'
import { computeLineStarts, rangeContainsPosition } from './source-text-positions'

export type JsImportBinding = {
  localName: string
  /** 'default', '*' (namespace import / whole-module require) or the exported name. */
  importedName: string
  specifier: string
  /** The local name token. */
  localRange: CodeRange
  /** The whole import/require statement. */
  statementRange: CodeRange
}

export type JsExportEntry =
  | { kind: 'local'; exportedName: string; localName: string; nameRange: CodeRange }
  | {
      kind: 'reexport'
      exportedName: string
      importedName: string
      specifier: string
      nameRange: CodeRange
    }
  | { kind: 'star'; specifier: string }

export type JsTopLevelDeclaration = { name: string; kind: CodeSymbolKind; nameRange: CodeRange }

export type JsModuleSpecifier = {
  specifier: string
  /** The string literal, quotes included. */
  range: CodeRange
}

export type JsModuleSyntax = {
  imports: JsImportBinding[]
  exports: JsExportEntry[]
  declarations: JsTopLevelDeclaration[]
  specifiers: JsModuleSpecifier[]
}

/** Top-level module structure of TS/TSX/JS/JSX source, tolerant of syntax it does not model. */
export function parseJsModuleSyntax(text: string): JsModuleSyntax {
  const builder: JsSyntaxBuilder = {
    text,
    tokens: lexJsSource(text),
    lineStarts: computeLineStarts(text),
    syntax: { imports: [], exports: [], declarations: [], specifiers: [] },
    specifierStarts: new Set()
  }
  const { tokens } = builder
  let forcedStart = -1
  let i = 0
  while (i < tokens.length) {
    if (tokens[i].depth !== 0) {
      i++
      continue
    }
    const atStart = i === forcedStart || isStatementStart(builder, i)
    if (atStart && isPunct(builder, i, '@')) {
      forcedStart = skipDecorator(builder, i)
      i = forcedStart
      continue
    }
    const next =
      readImportStatement(builder, i) ??
      readExportStatement(builder, i) ??
      (atStart
        ? (readCommonJsExport(builder, i) ?? readTopLevelDeclaration(builder, i)?.next)
        : null)
    i = next !== null && next !== undefined && next > i ? next : i + 1
  }
  collectDynamicSpecifiers(builder)
  builder.syntax.specifiers.sort(
    (a, b) =>
      a.range.startLineNumber - b.range.startLineNumber || a.range.startColumn - b.range.startColumn
  )
  return builder.syntax
}

function skipDecorator(builder: JsSyntaxBuilder, at: number): number {
  let i = at + 1
  while (isName(builder, i) && isPunct(builder, i + 1, '.')) {
    i += 2
  }
  if (isName(builder, i)) {
    i++
  }
  if (isPunct(builder, i, '(')) {
    const close = matchingClose(builder, i)
    return close === -1 ? builder.tokens.length : close + 1
  }
  return i
}

function rangeStrictlyContains(range: CodeRange, position: CodePosition): boolean {
  return (
    rangeContainsPosition(range, position) &&
    !(position.lineNumber === range.endLineNumber && position.column === range.endColumn)
  )
}

/** Prefers a range that strictly contains `position`, then one it touches at the end. */
function findTouching<T>(
  items: readonly T[],
  position: CodePosition,
  ranges: (item: T) => (CodeRange | undefined)[]
): T | null {
  for (const contains of [rangeStrictlyContains, rangeContainsPosition]) {
    const hit = items.find((item) =>
      ranges(item).some((range) => range !== undefined && contains(range, position))
    )
    if (hit) {
      return hit
    }
  }
  return null
}

/** The binding whose local name, or imported name inside its statement, is at `position`. */
export function findImportBindingAt(
  syntax: JsModuleSyntax,
  position: CodePosition
): JsImportBinding | null {
  return findTouching(syntax.imports, position, (binding) => [
    binding.localRange,
    importedNameRangeOf(binding)
  ])
}

export function findModuleSpecifierAt(
  syntax: JsModuleSyntax,
  position: CodePosition
): JsModuleSpecifier | null {
  return findTouching(syntax.specifiers, position, (specifier) => [specifier.range])
}
