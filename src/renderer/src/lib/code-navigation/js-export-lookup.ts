import type { CodeNavigationFileAccess, CodeRange } from './code-navigation-types'
import { parseJsModuleSyntax, type JsModuleSyntax } from './js-module-syntax'
import { resolveTsModule } from './ts-module-resolution'

export type ExportedDeclarationLocation = { relativePath: string; range: CodeRange }

const MAX_DEPTH = 4
const MAX_PARSED_FILES = 64
const FILE_START: CodeRange = { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 }

const parsedFiles = new Map<string, { text: string; syntax: JsModuleSyntax }>()

/** Parses `text`, reusing the last parse cached under `key` while the text is unchanged. */
export function cachedJsModuleSyntax(key: string, text: string): JsModuleSyntax {
  const cached = parsedFiles.get(key)
  parsedFiles.delete(key)
  const entry = cached?.text === text ? cached : { text, syntax: parseJsModuleSyntax(text) }
  parsedFiles.set(key, entry)
  if (parsedFiles.size > MAX_PARSED_FILES) {
    const oldest = parsedFiles.keys().next().value
    if (oldest !== undefined) {
      parsedFiles.delete(oldest)
    }
  }
  return entry.syntax
}

type LookupState = {
  files: CodeNavigationFileAccess
  signal: AbortSignal
  visited: Set<string>
}

/**
 * Where `exportName` exported by `relativePath` is declared, following re-exports, `export *`
 * and re-exported imports across files. `'*'` names the module itself.
 */
export async function findExportedDeclaration(params: {
  files: CodeNavigationFileAccess
  relativePath: string
  exportName: string
  signal: AbortSignal
  depth?: number
  visited?: Set<string>
}): Promise<ExportedDeclarationLocation | null> {
  const state = { files: params.files, signal: params.signal, visited: params.visited ?? new Set() }
  return lookup(state, params.relativePath, params.exportName, params.depth ?? 0, false)
}

async function lookup(
  state: LookupState,
  relativePath: string,
  exportName: string,
  depth: number,
  viaStar: boolean
): Promise<ExportedDeclarationLocation | null> {
  const visitKey = `${relativePath}#${exportName}`
  if (depth > MAX_DEPTH || state.visited.has(visitKey)) {
    return null
  }
  state.visited.add(visitKey)
  if (exportName === '*') {
    return { relativePath, range: FILE_START }
  }
  const text = await state.files.readText(relativePath, state.signal)
  state.signal.throwIfAborted()
  if (text === null) {
    return null
  }
  const syntax = cachedJsModuleSyntax(`${state.files.cacheScope}:${relativePath}`, text)
  const here = (range: CodeRange): ExportedDeclarationLocation => ({ relativePath, range })
  for (const entry of syntax.exports) {
    if (entry.kind === 'star' || entry.exportedName !== exportName) {
      continue
    }
    if (entry.kind === 'local') {
      const local = await resolveLocalName(state, relativePath, syntax, entry.localName, depth)
      return local ?? here(entry.nameRange)
    }
    const target = await resolveTsModule(state.files, entry.specifier, relativePath, state.signal)
    const found = target && (await lookup(state, target, entry.importedName, depth + 1, false))
    return found || here(entry.nameRange)
  }
  if (exportName !== 'default') {
    for (const entry of syntax.exports) {
      if (entry.kind !== 'star') {
        continue
      }
      const target = await resolveTsModule(state.files, entry.specifier, relativePath, state.signal)
      const found = target && (await lookup(state, target, exportName, depth + 1, true))
      if (found) {
        return found
      }
    }
  }
  // Why: TS globals and merged namespaces are reachable without an export; a star hop is not.
  const declaration = viaStar ? undefined : syntax.declarations.find((d) => d.name === exportName)
  return declaration ? here(declaration.nameRange) : null
}

async function resolveLocalName(
  state: LookupState,
  relativePath: string,
  syntax: JsModuleSyntax,
  localName: string,
  depth: number
): Promise<ExportedDeclarationLocation | null> {
  if (localName === '') {
    return null
  }
  const declaration = syntax.declarations.find((d) => d.name === localName)
  if (declaration) {
    return { relativePath, range: declaration.nameRange }
  }
  const binding = syntax.imports.find((b) => b.localName === localName)
  if (!binding) {
    return null
  }
  const target = await resolveTsModule(state.files, binding.specifier, relativePath, state.signal)
  const found = target && (await lookup(state, target, binding.importedName, depth + 1, false))
  return found || { relativePath, range: binding.localRange }
}
