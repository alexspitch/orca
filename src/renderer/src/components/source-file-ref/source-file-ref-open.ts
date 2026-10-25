import { useAppStore } from '@/store'
import { basename } from '@/lib/path'
import { activateAndRevealWorktree } from '@/lib/worktree-activation'
import { listRuntimeFiles, searchRuntimeFilePaths } from '@/runtime/runtime-file-search-client'
import { openQuickOpenFile } from '@/components/quick-open-file-navigation'
import {
  getFileExplorerOperationOwner,
  getFileExplorerOperationRoute,
  getFileExplorerOwnerUnresolvedMessage
} from '@/components/right-sidebar/file-explorer-operation-owner'
import { QUICK_OPEN_LISTING_MAX_RESULTS } from '../../../../shared/quick-open-listing-limits'
import { sourceFileRefMatches, type SourceFileRef } from './source-file-ref'

// Opening a plan's file reference in the worktree the work happens in, as Quick Open would.

// The most a host's `files.searchPaths` answers in one call.
const SEARCH_PATHS_MAX_LIMIT = 32

export type SourceFileRefScope = { worktreeId: string; root: string }

/** The named worktree, else the one in front: a plan file often lives outside any worktree. */
export function sourceFileRefScopeOf(
  worktreeId: string | null | undefined
): SourceFileRefScope | null {
  const state = useAppStore.getState()
  const id = worktreeId ?? state.activeWorktreeId
  const root = id ? state.getKnownWorktreeById(id)?.path : undefined
  return id && root ? { worktreeId: id, root } : null
}

/** Worktree-relative paths the reference can mean, nearest the root first. */
export async function findSourceFileRefPaths(
  scope: SourceFileRefScope,
  ref: SourceFileRef
): Promise<string[]> {
  const route = getFileExplorerOperationRoute(getFileExplorerOperationOwner(scope.worktreeId))
  if (!route) {
    throw new Error(getFileExplorerOwnerUnresolvedMessage())
  }
  const context = { ...route, worktreeId: scope.worktreeId, worktreePath: scope.root }
  // Why two routes: only a local host filters a listing by name; the others search paths.
  const files =
    route.target.kind === 'local' && !route.connectionId
      ? await listRuntimeFiles(context, {
          rootPath: scope.root,
          includeIgnored: false,
          allowLegacyIncludeIgnored: true,
          nameFilter: basename(ref.path),
          maxResults: QUICK_OPEN_LISTING_MAX_RESULTS
        })
      : (
          await searchRuntimeFilePaths(context, {
            query: ref.path,
            limit: SEARCH_PATHS_MAX_LIMIT,
            includeIgnored: false,
            allowLegacyIncludeIgnored: true
          })
        ).files
  return sourceFileRefMatches(files, ref.path)
}

export function openSourceFileRefPath(
  scope: SourceFileRefScope,
  path: string,
  ref: SourceFileRef
): Promise<void> {
  // Why: the reference may be clicked on a page that is not the worktree's, the Issues page above all.
  const hostId = useAppStore.getState().getKnownWorktreeById(scope.worktreeId)?.hostId
  activateAndRevealWorktree(scope.worktreeId, {
    providesInitialSurface: true,
    ...(hostId ? { executionHostId: hostId } : {})
  })
  return openQuickOpenFile(path, scope.worktreeId, scope.root, {
    pathQuery: ref.path,
    ...(ref.line !== undefined ? { line: ref.line } : {})
  })
}
