import type { editor } from 'monaco-editor'
import { useAppStore } from '@/store'
import { getRelativePathInsideRoot } from '@/lib/path'
import { toEditorModelUri } from '@/components/editor/editor-model-uri'
import { getEditorModelOwnerKey } from '@/components/editor/editor-model-owner'
import { selectMarkdownDocumentWorktreePath } from '@/components/editor/markdown-document-worktree-path-selector'
import type { CodeNavigationDocument } from './code-navigation-types'
import { isCodeNavigationLanguage } from './code-navigation-languages'
import { createCodeNavigationFileAccess } from './code-navigation-file-access'
import {
  getNavigationModelContext,
  rememberEditModelContext,
  type CodeNavigationModelContext
} from './code-navigation-models'

export type CodeNavigationTextModel = Pick<
  editor.ITextModel,
  'uri' | 'getValue' | 'getVersionId' | 'getLanguageId'
>

/** The workspace context of an edit-tab or navigation model; null limits navigation to the model. */
export function resolveCodeNavigationModelContext(
  modelUri: string
): CodeNavigationModelContext | null {
  const state = useAppStore.getState()
  for (const file of state.openFiles) {
    // Artifact, external-SSH and untitled tabs have no workspace root to resolve imports against.
    if (
      file.mode !== 'edit' ||
      file.isUntitled ||
      file.terminalArtifactGrantId ||
      file.externalSshTargetId
    ) {
      continue
    }
    const ownerKey = getEditorModelOwnerKey(file, state)
    if (toEditorModelUri(file.filePath, ownerKey) !== modelUri) {
      continue
    }
    const rootPath = selectMarkdownDocumentWorktreePath(state, file.worktreeId)
    const relativePath = rootPath ? getRelativePathInsideRoot(file.filePath, rootPath) : null
    if (!rootPath || !relativePath) {
      return null
    }
    const context: CodeNavigationModelContext = {
      worktreeId: file.worktreeId,
      rootPath,
      runtimeEnvironmentId: file.runtimeEnvironmentId,
      ownerKey,
      filePath: file.filePath,
      relativePath: relativePath.replace(/\\/g, '/')
    }
    rememberEditModelContext(modelUri, context)
    return context
  }
  // Navigation models, and retained models of tabs closed since a jump targeted them.
  return getNavigationModelContext(modelUri)
}

export function buildCodeNavigationDocument(
  model: CodeNavigationTextModel
): { doc: CodeNavigationDocument; context: CodeNavigationModelContext | null } | null {
  const languageId = model.getLanguageId()
  if (!isCodeNavigationLanguage(languageId)) {
    return null
  }
  const modelUri = model.uri.toString()
  const context = resolveCodeNavigationModelContext(modelUri)
  return {
    doc: {
      modelUri,
      languageId,
      text: model.getValue(),
      version: model.getVersionId(),
      relativePath: context?.relativePath ?? null,
      files: context ? createCodeNavigationFileAccess(context) : null
    },
    context
  }
}
