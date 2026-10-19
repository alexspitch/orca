import { useAppStore } from '@/store'
import { joinPath } from '@/lib/path'
import { editorModelRegistry } from '@/lib/editor-model-registry'
import { requireRuntimeTargetForFileOwner } from '@/lib/file-owner-runtime-target'
import { getConnectionIdForFile } from '@/lib/connection-context'
import { readRuntimeFileContent } from '@/runtime/runtime-file-read-client'
import { runtimePathExists } from '@/runtime/runtime-file-metadata-client'
import { searchRuntimeFiles } from '@/runtime/runtime-file-search-client'
import type { RuntimeFileOperationArgs } from '@/runtime/runtime-file-client-types'
import { toEditorModelUri } from '@/components/editor/editor-model-uri'
import type { CodeDefinitionSearchMatch, CodeNavigationFileAccess } from './code-navigation-types'
import { DEFINITION_SEARCH_EXCLUDE_GLOBS } from './code-navigation-languages'

/** Where a navigable file lives: the owning workspace and host, as its editor tab knows them. */
export type CodeNavigationOwnerContext = {
  worktreeId: string
  rootPath: string
  runtimeEnvironmentId: string | null | undefined
  /** The edit-model owner key ('' local); keeps hosts apart in caches and model URIs. */
  ownerKey: string
}

const MAX_NAVIGATION_FILE_CHARS = 1024 * 1024
const DISK_SNAPSHOT_TTL_MS = 30_000
const MAX_DISK_SNAPSHOTS = 64

type DiskSnapshot = { text: string | null; readAt: number }
const diskSnapshots = new Map<string, DiskSnapshot>()

function rememberSnapshot(key: string, text: string | null): void {
  diskSnapshots.delete(key)
  diskSnapshots.set(key, { text, readAt: Date.now() })
  while (diskSnapshots.size > MAX_DISK_SNAPSHOTS) {
    const oldest = diskSnapshots.keys().next().value
    if (oldest === undefined) {
      break
    }
    diskSnapshots.delete(oldest)
  }
}

export function codeNavigationCacheScope(context: CodeNavigationOwnerContext): string {
  return `${context.ownerKey}|${context.rootPath}`
}

function operationArgs(context: CodeNavigationOwnerContext): RuntimeFileOperationArgs {
  return {
    target: requireRuntimeTargetForFileOwner(
      useAppStore.getState(),
      context.worktreeId,
      context.runtimeEnvironmentId
    ),
    worktreeId: context.worktreeId,
    worktreePath: context.rootPath,
    connectionId: getConnectionIdForFile(context.worktreeId, context.rootPath) ?? undefined
  }
}

/** Live text of an open tab's model, so unsaved edits are what navigation reads. */
function readOpenModelText(
  context: CodeNavigationOwnerContext,
  absolutePath: string
): string | null {
  const registry = editorModelRegistry.get()
  if (!registry) {
    return null
  }
  const model = registry.editor.getModel(
    registry.Uri.parse(toEditorModelUri(absolutePath, context.ownerKey))
  )
  return model && !model.isDisposed() ? model.getValue() : null
}

export function createCodeNavigationFileAccess(
  context: CodeNavigationOwnerContext
): CodeNavigationFileAccess {
  const cacheScope = codeNavigationCacheScope(context)
  return {
    cacheScope,
    async readText(relativePath, signal) {
      const absolutePath = joinPath(context.rootPath, relativePath)
      const openText = readOpenModelText(context, absolutePath)
      if (openText !== null) {
        return openText
      }
      const key = `${cacheScope}::${relativePath}`
      const cached = diskSnapshots.get(key)
      if (cached && Date.now() - cached.readAt < DISK_SNAPSHOT_TTL_MS) {
        return cached.text
      }
      let text: string | null = null
      try {
        const args = operationArgs(context)
        const result = await readRuntimeFileContent({
          target: args.target,
          filePath: absolutePath,
          relativePath,
          worktreeId: context.worktreeId,
          connectionId: args.connectionId
        })
        text =
          result.isBinary || result.content.length > MAX_NAVIGATION_FILE_CHARS
            ? null
            : result.content
      } catch {
        // Missing or unreadable files are simply not navigation targets.
        text = null
      }
      signal.throwIfAborted()
      rememberSnapshot(key, text)
      return text
    },
    async existing(relativePaths, signal) {
      const unique = [...new Set(relativePaths)]
      const args = operationArgs(context)
      const found = await Promise.all(
        unique.map(async (relativePath) => {
          const absolutePath = joinPath(context.rootPath, relativePath)
          if (readOpenModelText(context, absolutePath) !== null) {
            return true
          }
          return runtimePathExists(args, absolutePath).catch(() => false)
        })
      )
      signal.throwIfAborted()
      return new Set(unique.filter((_, index) => found[index]))
    },
    async searchDefinitions(query, signal) {
      const result = await searchRuntimeFiles(
        operationArgs(context),
        {
          query: query.regex,
          rootPath: context.rootPath,
          caseSensitive: true,
          useRegex: true,
          includePattern: query.includeGlobs,
          excludePattern: DEFINITION_SEARCH_EXCLUDE_GLOBS,
          maxResults: query.maxResults
        },
        signal
      )
      const matches: CodeDefinitionSearchMatch[] = []
      for (const file of result.files) {
        for (const match of file.matches) {
          // A clipped long line has a display column that no longer maps to the source.
          if (match.displayColumn !== undefined) {
            continue
          }
          matches.push({
            relativePath: file.relativePath.replace(/\\/g, '/'),
            line: match.line,
            column: match.column,
            matchLength: match.matchLength,
            lineContent: match.lineContent
          })
        }
      }
      return matches
    }
  }
}
