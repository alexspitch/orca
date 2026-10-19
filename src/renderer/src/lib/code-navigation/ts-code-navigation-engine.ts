import type {
  CodeDefinitionResult,
  CodeNavigationDocument,
  CodeNavigationEngine,
  CodePosition
} from './code-navigation-types'
import {
  computeLineStarts,
  identifierAtPosition,
  offsetRangeToCodeRange,
  positionToOffset,
  type LineStarts
} from './source-text-positions'
import { findDefinitionsBySearch } from './definition-search-fallback'
import {
  findImportBindingAt,
  findModuleSpecifierAt,
  parseJsModuleSyntax,
  type JsImportBinding,
  type JsModuleSyntax
} from './js-module-syntax'
import { resolveTsModule } from './ts-module-resolution'
import { findExportedDeclaration } from './js-export-lookup'
import {
  isTsLibFileName,
  navigationTreeToOutline,
  toDefinitionInfos,
  type TsTextSpan,
  type TsWorkerLike
} from './ts-worker-client'

export type TsCodeNavigationEngineDeps = {
  getWorker(doc: CodeNavigationDocument): Promise<TsWorkerLike | null>
  /** Maps a worker result in another open model to a workspace location, if it is one. */
  mapForeignDefinition(
    doc: CodeNavigationDocument,
    fileName: string,
    span: TsTextSpan
  ): CodeDefinitionResult | null
}

const FILE_START = { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 }

type ParsedDocument = { key: string; lineStarts: LineStarts; syntax: JsModuleSyntax }
let lastParsed: ParsedDocument | null = null

function parseDocument(doc: CodeNavigationDocument): ParsedDocument {
  const key = `${doc.modelUri}@${doc.version}`
  if (lastParsed?.key !== key) {
    lastParsed = {
      key,
      lineStarts: computeLineStarts(doc.text),
      syntax: parseJsModuleSyntax(doc.text)
    }
  }
  return lastParsed
}

function toResult(
  doc: CodeNavigationDocument,
  relativePath: string,
  range: CodeDefinitionResult['range']
): CodeDefinitionResult {
  return {
    target:
      relativePath === doc.relativePath ? { kind: 'same' } : { kind: 'workspace', relativePath },
    range,
    source: 'import'
  }
}

async function hopToImport(
  doc: CodeNavigationDocument,
  binding: Pick<JsImportBinding, 'specifier' | 'importedName'>,
  signal: AbortSignal
): Promise<CodeDefinitionResult | null> {
  if (!doc.files || doc.relativePath === null) {
    return null
  }
  const target = await resolveTsModule(doc.files, binding.specifier, doc.relativePath, signal)
  if (!target) {
    return null
  }
  if (binding.importedName === '*') {
    return toResult(doc, target, FILE_START)
  }
  const found = await findExportedDeclaration({
    files: doc.files,
    relativePath: target,
    exportName: binding.importedName,
    signal
  })
  return found ? toResult(doc, found.relativePath, found.range) : toResult(doc, target, FILE_START)
}

/** `ns.member` where `ns` is a namespace import: the receiver identifier, if any. */
function namespaceReceiverBefore(text: string, startOffset: number): string | null {
  const before = text.slice(Math.max(0, startOffset - 256), startOffset)
  const match = /([A-Za-z_$][A-Za-z0-9_$]*)\s*\??\.\s*$/.exec(before)
  return match ? match[1] : null
}

export function createTsCodeNavigationEngine(
  deps: TsCodeNavigationEngineDeps
): CodeNavigationEngine {
  return {
    id: 'builtin-typescript',
    supports: (languageId) => languageId === 'typescript' || languageId === 'javascript',

    async getOutline(doc) {
      const worker = await deps.getWorker(doc)
      if (!worker) {
        return null
      }
      const tree = await worker.getNavigationTree(doc.modelUri)
      return navigationTreeToOutline(tree, parseDocument(doc).lineStarts)
    },

    async getDefinitions(doc, position: CodePosition, signal) {
      const { lineStarts, syntax } = parseDocument(doc)
      const specifier = findModuleSpecifierAt(syntax, position)
      if (specifier) {
        const hop = await hopToImport(
          doc,
          { specifier: specifier.specifier, importedName: '*' },
          signal
        )
        return hop ? [hop] : []
      }
      const identifier = identifierAtPosition(doc.text, lineStarts, position, true)
      if (!identifier) {
        return []
      }
      const worker = await deps.getWorker(doc)
      const infos = worker
        ? toDefinitionInfos(
            await worker.getDefinitionAtPosition(
              doc.modelUri,
              positionToOffset(lineStarts, position)
            )
          )
        : []
      signal.throwIfAborted()
      const results: CodeDefinitionResult[] = []
      let resolvedToLibrary = false
      let unresolvedImport: CodeDefinitionResult | null = null
      for (const info of infos) {
        if (info.fileName !== doc.modelUri) {
          if (isTsLibFileName(info.fileName)) {
            resolvedToLibrary = true
            continue
          }
          const foreign = deps.mapForeignDefinition(doc, info.fileName, info.textSpan)
          if (foreign) {
            results.push(foreign)
          }
          continue
        }
        const range = offsetRangeToCodeRange(
          lineStarts,
          info.textSpan.start,
          info.textSpan.start + info.textSpan.length
        )
        // Why: the worker only sees this file, so an imported name resolves to its import binding.
        const binding = findImportBindingAt(syntax, {
          lineNumber: range.startLineNumber,
          column: range.startColumn
        })
        if (!binding) {
          results.push({ target: { kind: 'same' }, range, source: 'semantic' })
          continue
        }
        const hop = await hopToImport(doc, binding, signal)
        if (hop) {
          results.push(hop)
        } else {
          unresolvedImport ??= { target: { kind: 'same' }, range, source: 'semantic' }
        }
      }
      if (results.length > 0) {
        return results
      }
      if (resolvedToLibrary) {
        return []
      }
      if (infos.length === 0) {
        const receiver = namespaceReceiverBefore(doc.text, identifier.startOffset)
        // The worker gave nothing: try `ns.member` on a namespace import, then a bare imported name.
        const importBinding = receiver
          ? syntax.imports.find(
              (entry) => entry.localName === receiver && entry.importedName === '*'
            )
          : syntax.imports.find((entry) => entry.localName === identifier.name)
        if (importBinding) {
          const hop = await hopToImport(
            doc,
            receiver
              ? { specifier: importBinding.specifier, importedName: identifier.name }
              : importBinding,
            signal
          )
          if (hop) {
            return [hop]
          }
        }
      }
      const searched = await findDefinitionsBySearch({
        doc,
        name: identifier.name,
        excludeLine: position.lineNumber,
        signal
      })
      return searched.length > 0 || !unresolvedImport ? searched : [unresolvedImport]
    }
  }
}
