import {
  isWindowsAbsolutePathLike,
  relativePathInsideRoot,
  resolveRuntimePath
} from '../../../src/shared/cross-platform-path'
import { splitFilePathLineSuffix } from '../components/markdown-file-path-detection'
import {
  createMobileFilePreviewHref,
  type MobileFilePreviewRouteParams
} from './mobile-file-preview-route'

export function mobileMarkdownFileLink(params: MobileFilePreviewRouteParams, pathText: string) {
  if (params.source === 'terminalArtifact' || !params.relativePath) {
    return null
  }
  const source = params.relativePath.replaceAll('\\', '/')
  return worktreeFileLink(params, source.slice(0, source.lastIndexOf('/') + 1), pathText)
}

/** A path a Markdown names, under `directory` of the worktree (`''` for its root); null outside it. */
export function worktreeFileLink(
  target: Pick<MobileFilePreviewRouteParams, 'hostId' | 'worktreeId' | 'worktreeName'>,
  directory: string,
  pathText: string
) {
  const { path, line, column } = splitFilePathLineSuffix(pathText)
  if (!path || /^[\\/]/.test(path) || isWindowsAbsolutePathLike(path) || path.includes('\0')) {
    return null
  }
  // Resolve under a virtual root; the host still authorizes the actual workspace read.
  const root = '/workspace'
  const resolved = resolveRuntimePath(`${root}/${directory}`, path)
  const relativePath = relativePathInsideRoot(root, resolved)
  if (!relativePath) {
    return null
  }
  return createMobileFilePreviewHref({
    hostId: target.hostId,
    worktreeId: target.worktreeId,
    worktreeName: target.worktreeName,
    source: 'worktree',
    relativePath,
    ...(line !== null ? { line: String(line) } : {}),
    ...(column !== null ? { column: String(column) } : {})
  })
}
