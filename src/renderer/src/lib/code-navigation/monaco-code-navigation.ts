import type * as Monaco from 'monaco-editor'
import type { CancellationToken, editor, IDisposable, languages } from 'monaco-editor'
import { typescript as monacoTS } from 'monaco-editor'
import type {
  CodeDefinitionResult,
  CodeNavigationDocument,
  CodeOutlineSymbol,
  CodeSymbolKind
} from './code-navigation-types'
import {
  getCodeDefinitions,
  getCodeOutline,
  registerCodeNavigationEngine
} from './code-navigation-engine-registry'
import {
  buildCodeNavigationDocument,
  resolveCodeNavigationModelContext
} from './code-navigation-document'
import { codeNavigationCacheScope } from './code-navigation-file-access'
import { materializeDefinitionLocation } from './code-navigation-models'
import { codeNavigationEditorOpener } from './code-navigation-editor-opener'
import { createTsCodeNavigationEngine } from './ts-code-navigation-engine'
import type { TsTextSpan, TsWorkerLike } from './ts-worker-client'
import { pythonCodeNavigationEngine } from './python-code-navigation-engine'

type MonacoApi = typeof Monaco

function abortSignalFor(token: CancellationToken): AbortSignal {
  const controller = new AbortController()
  if (token.isCancellationRequested) {
    controller.abort()
  } else {
    token.onCancellationRequested(() => controller.abort())
  }
  return controller.signal
}

function createTsWorkerAccess(monaco: MonacoApi) {
  return async (doc: CodeNavigationDocument): Promise<TsWorkerLike | null> => {
    const getWorker =
      doc.languageId === 'javascript'
        ? await monacoTS.getJavaScriptWorker()
        : await monacoTS.getTypeScriptWorker()
    return getWorker(monaco.Uri.parse(doc.modelUri))
  }
}

function createForeignDefinitionMapper(monaco: MonacoApi) {
  return (
    doc: CodeNavigationDocument,
    fileName: string,
    span: TsTextSpan
  ): CodeDefinitionResult | null => {
    const model = monaco.editor.getModel(monaco.Uri.parse(fileName))
    const context = resolveCodeNavigationModelContext(fileName)
    // Only another file of this same workspace and host is a navigable target.
    if (
      !model ||
      !context ||
      !doc.files ||
      codeNavigationCacheScope(context) !== doc.files.cacheScope
    ) {
      return null
    }
    const start = model.getPositionAt(span.start)
    const end = model.getPositionAt(span.start + span.length)
    return {
      target: { kind: 'workspace', relativePath: context.relativePath },
      range: {
        startLineNumber: start.lineNumber,
        startColumn: start.column,
        endLineNumber: end.lineNumber,
        endColumn: end.column
      },
      source: 'semantic'
    }
  }
}

function symbolKindFor(monaco: MonacoApi, kind: CodeSymbolKind): languages.SymbolKind {
  const kinds = monaco.languages.SymbolKind
  const map: Record<CodeSymbolKind, languages.SymbolKind> = {
    module: kinds.Module,
    namespace: kinds.Namespace,
    class: kinds.Class,
    interface: kinds.Interface,
    enum: kinds.Enum,
    enumMember: kinds.EnumMember,
    type: kinds.TypeParameter,
    function: kinds.Function,
    method: kinds.Method,
    constructor: kinds.Constructor,
    property: kinds.Property,
    field: kinds.Field,
    variable: kinds.Variable,
    constant: kinds.Constant
  }
  return map[kind]
}

function toDocumentSymbols(
  monaco: MonacoApi,
  symbols: readonly CodeOutlineSymbol[]
): languages.DocumentSymbol[] {
  return symbols.map((symbol) => ({
    name: symbol.name,
    detail: '',
    kind: symbolKindFor(monaco, symbol.kind),
    tags: [],
    range: symbol.range,
    selectionRange: symbol.selectionRange,
    children: toDocumentSymbols(monaco, symbol.children)
  }))
}

const definitionProvider: languages.DefinitionProvider = {
  async provideDefinition(model: editor.ITextModel, position, token) {
    const built = buildCodeNavigationDocument(model)
    if (!built) {
      return null
    }
    const signal = abortSignalFor(token)
    try {
      const results = await getCodeDefinitions(built.doc, position, signal)
      const locations = await Promise.all(
        results.map((result) =>
          materializeDefinitionLocation({
            source: { modelUri: model.uri, context: built.context },
            files: built.doc.files,
            result,
            signal
          })
        )
      )
      return locations.filter((location) => location !== null)
    } catch (error) {
      if (signal.aborted) {
        return null
      }
      throw error
    }
  }
}

function createPythonSymbolProvider(monaco: MonacoApi): languages.DocumentSymbolProvider {
  return {
    async provideDocumentSymbols(model, token) {
      const built = buildCodeNavigationDocument(model)
      if (!built) {
        return null
      }
      const signal = abortSignalFor(token)
      try {
        return toDocumentSymbols(monaco, await getCodeOutline(built.doc, signal))
      } catch (error) {
        if (signal.aborted) {
          return null
        }
        throw error
      }
    }
  }
}

let installed: { dispose: () => void } | null = null

export function uninstallMonacoCodeNavigation(): void {
  installed?.dispose()
}

/** Go-to-definition and Python symbols for the source editor; idempotent and HMR-disposable. */
export function installMonacoCodeNavigation(monaco: MonacoApi): () => void {
  if (installed) {
    return installed.dispose
  }
  const disposables: IDisposable[] = []
  const unregisterEngines = [
    registerCodeNavigationEngine(
      createTsCodeNavigationEngine({
        getWorker: createTsWorkerAccess(monaco),
        mapForeignDefinition: createForeignDefinitionMapper(monaco)
      })
    ),
    registerCodeNavigationEngine(pythonCodeNavigationEngine)
  ]
  disposables.push(
    monaco.languages.registerDefinitionProvider(
      ['typescript', 'javascript', 'python'],
      definitionProvider
    ),
    monaco.languages.registerDocumentSymbolProvider('python', createPythonSymbolProvider(monaco)),
    monaco.editor.registerEditorOpener(codeNavigationEditorOpener)
  )
  // Why last: if anything above threw, Monaco's own TS definitions stay on. Ours replace them
  // because Monaco merges providers, and the worker's import-binding answer would turn every
  // cross-file jump into a two-entry Peek. Diagnostics are already silenced; turning the
  // component off also stops it syncing every TS model into the worker after each edit.
  const restoreModes = [monacoTS.typescriptDefaults, monacoTS.javascriptDefaults].map(
    (defaults) => {
      const previous = defaults.modeConfiguration
      defaults.setModeConfiguration({ ...previous, definitions: false, diagnostics: false })
      return () => defaults.setModeConfiguration(previous)
    }
  )
  const dispose = (): void => {
    if (!installed) {
      return
    }
    installed = null
    for (const restore of restoreModes) {
      restore()
    }
    for (const disposable of disposables) {
      disposable.dispose()
    }
    for (const unregister of unregisterEngines) {
      unregister()
    }
  }
  installed = { dispose }
  return dispose
}
