import type { IRange, Uri } from 'monaco-editor'
import { editorModelRegistry } from '@/lib/editor-model-registry'
import { detectLanguage } from '@/lib/language-detect'
import { joinPath } from '@/lib/path'
import { toEditorModelUri } from '@/components/editor/editor-model-uri'
import type { CodeDefinitionResult, CodeNavigationFileAccess } from './code-navigation-types'
import type { CodeNavigationOwnerContext } from './code-navigation-file-access'

/** A navigable file: its owner plus where it sits in the workspace. */
export type CodeNavigationModelContext = CodeNavigationOwnerContext & {
  filePath: string
  /** POSIX, relative to `rootPath`. */
  relativePath: string
}

// Why a separate scheme: @monaco-editor/react would adopt a hidden model sharing a tab's `file:`
// URI as that tab's buffer, and tab-close/diff disposal only ever matches `file:`/`diff:` URIs.
export const NAVIGATION_MODEL_SCHEME = 'orca-nav'
const MAX_NAVIGATION_MODELS = 20

const contextsByUri = new Map<string, CodeNavigationModelContext>()
const navigationModelUris: string[] = []

export function getNavigationModelContext(modelUri: string): CodeNavigationModelContext | null {
  return contextsByUri.get(modelUri) ?? null
}

function touchNavigationModel(uri: string): void {
  const index = navigationModelUris.indexOf(uri)
  if (index !== -1) {
    navigationModelUris.splice(index, 1)
  }
  navigationModelUris.push(uri)
}

function evictNavigationModels(): void {
  const registry = editorModelRegistry.get()
  let index = 0
  while (navigationModelUris.length > MAX_NAVIGATION_MODELS && index < navigationModelUris.length) {
    const uri = navigationModelUris[index]
    const model = registry?.editor.getModel(registry.Uri.parse(uri))
    // An open Peek still shows this model; keep it until a later eviction pass.
    if (model?.isAttachedToEditor()) {
      index++
      continue
    }
    navigationModelUris.splice(index, 1)
    contextsByUri.delete(uri)
    model?.dispose()
  }
}

function navigationModelUri(context: CodeNavigationModelContext): Uri | null {
  const registry = editorModelRegistry.get()
  if (!registry) {
    return null
  }
  return registry.Uri.from({
    scheme: NAVIGATION_MODEL_SCHEME,
    path: registry.Uri.file(context.filePath).path,
    fragment: context.ownerKey
  })
}

/**
 * Turns a definition result into a Monaco location. Prefers an open tab's model (its live draft
 * shows in Peek); otherwise loads the file into a hidden navigation model.
 */
export async function materializeDefinitionLocation(params: {
  source: { modelUri: Uri; context: CodeNavigationOwnerContext | null }
  files: CodeNavigationFileAccess | null
  result: CodeDefinitionResult
  signal: AbortSignal
}): Promise<{ uri: Uri; range: IRange } | null> {
  const { source, result } = params
  if (result.target.kind === 'same') {
    return { uri: source.modelUri, range: result.range }
  }
  const registry = editorModelRegistry.get()
  if (!registry || !source.context || !params.files) {
    return null
  }
  const relativePath = result.target.relativePath
  const context: CodeNavigationModelContext = {
    ...source.context,
    filePath: joinPath(source.context.rootPath, relativePath),
    relativePath
  }
  const editUri = registry.Uri.parse(toEditorModelUri(context.filePath, context.ownerKey))
  if (registry.editor.getModel(editUri)) {
    contextsByUri.set(editUri.toString(), context)
    return { uri: editUri, range: result.range }
  }
  const text = await params.files.readText(relativePath, params.signal)
  const uri = navigationModelUri(context)
  if (text === null || !uri) {
    return null
  }
  const key = uri.toString()
  const existing = registry.editor.getModel(uri)
  if (existing) {
    if (existing.getValue() !== text) {
      existing.setValue(text)
    }
  } else {
    registry.editor.createModel(text, detectLanguage(context.filePath), uri)
  }
  contextsByUri.set(key, context)
  touchNavigationModel(key)
  evictNavigationModels()
  return { uri, range: result.range }
}

/** Remembers an open tab's model so the editor opener can route a jump into it. */
export function rememberEditModelContext(
  modelUri: string,
  context: CodeNavigationModelContext
): void {
  contextsByUri.set(modelUri, context)
}
