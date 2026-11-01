import type { RasterImageDimensions } from './raster-image-dimensions'
import type { RuntimeNavigationTarget } from './runtime-navigation'

export type RuntimeFileListEntry = {
  relativePath: string
  basename: string
  kind: 'text' | 'binary'
}

export type RuntimeFileListResult = {
  worktree: string
  rootPath: string
  files: RuntimeFileListEntry[]
  totalCount: number
  truncated: boolean
  quickOpenSearchVersion?: number
}

export type RuntimeFileOpenResult = {
  worktree: string
  relativePath: string
  kind: 'markdown' | 'text' | 'binary' | 'image'
  opened: boolean
}

export type RuntimeFileOpenPosition = {
  line: number
  column?: number
}

/** A file main opened itself, which a window shows: layout-owner builds, local window only. */
export type RuntimeEditorFileOpen = {
  worktreeId: string
  filePath: string
  relativePath: string
  runtimeEnvironmentId?: string | null
  navigation?: RuntimeNavigationTarget
  position?: RuntimeFileOpenPosition
}

/** `frameSeq`: the layout stream position whose frame draws the tab. */
export type RuntimeEditorTabReveal = RuntimeEditorFileOpen & { tabId: string; frameSeq?: number }

export type RuntimeFileReadResult = {
  worktree: string
  relativePath: string
  content: string
  truncated: boolean
  byteLength: number
}

export type RuntimeTerminalPathOpenTarget =
  | {
      kind: 'worktree-file'
      provider: 'local' | 'ssh'
      relativePath: string
      absolutePath: string
    }
  | {
      kind: 'absolute-file'
      provider: 'local' | 'ssh'
      absolutePath: string
      grantId: string
      readOnly?: true
    }
  | {
      // A folder under the host's temp dir the terminal printed: listed, its files granted one by one.
      kind: 'absolute-directory'
      provider: 'local'
      absolutePath: string
      grantId: string
    }
  | { kind: 'unsupported'; reason: string }

/** A file of a granted terminal folder, by its path under it. */
export type RuntimeTerminalArtifactDirectoryEntry = { relativePath: string; size: number }

export type RuntimeTerminalArtifactDirectoryListing = {
  entries: RuntimeTerminalArtifactDirectoryEntry[]
  /** More files than the listing holds, or a folder deeper than it walks. */
  truncated: boolean
}

// Why a capability: an older host grants no folder, so a client asks before offering the list.
export const TERMINAL_ARTIFACT_DIRECTORY_RUNTIME_CAPABILITY =
  'files.terminal-artifact-directory.v1' as const

export type RuntimeNativeChatFileContext = {
  tabId: string
  sessionId: string
}

// Why: older hosts ignore crossWorkspace, so their refusal is no proof that no host workspace holds the path.
export const TERMINAL_PATH_CROSS_WORKSPACE_RUNTIME_CAPABILITY =
  'files.resolve-terminal-path.cross-workspace.v1' as const

export type RuntimeTerminalPathResolution = {
  worktree: string
  relativePath: string | null
  absolutePath: string | null
  exists: boolean
  isDirectory: boolean
  openTarget?: RuntimeTerminalPathOpenTarget
}

export type RuntimeFilePreviewResult = {
  content: string
  isBinary: boolean
  isImage?: boolean
  mimeType?: string
  imageDimensions?: RasterImageDimensions
}

export type RuntimeFileReadChunkResult = {
  contentBase64: string
  bytesRead: number
  eof: boolean
}
