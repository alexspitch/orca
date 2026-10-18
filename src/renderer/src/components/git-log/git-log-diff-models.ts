import { editorModelRegistry } from '@/lib/editor-model-registry'
import {
  disposeUnattachedMonacoModelsByPathPrefixes,
  getDiffViewerMonacoModelPathPrefixes
} from '../editor/diff-monaco-model-disposal'

/** Every diff the Git page's dialogs show is keyed under this, so they can be freed together. */
export const GIT_LOG_DIFF_MODEL_PREFIX = 'git-log:'

/**
 * Frees the Git page's diff models nothing shows any more. Why: the viewer keeps its models, and a
 * working-tree side reopened under the same key would show the file as it was the first time.
 */
export function disposeGitLogDiffModels(): void {
  const registry = editorModelRegistry.get()
  if (!registry) {
    return
  }
  const prefixes = getDiffViewerMonacoModelPathPrefixes(GIT_LOG_DIFF_MODEL_PREFIX)
  disposeUnattachedMonacoModelsByPathPrefixes(registry, [
    prefixes.originalModelPathPrefix,
    prefixes.modifiedModelPathPrefix
  ])
}
