import { zipSync } from 'fflate'
import { callHostRoute } from '@/runtime/host-route-call'
import { hostRouteForAuthority } from '@/runtime/runtime-client-target'
import { toRuntimeWorktreeSelector } from '@/runtime/runtime-worktree-selector'
import type {
  RuntimeFileReadChunkResult,
  RuntimeTerminalArtifactDirectoryListing,
  RuntimeTerminalPathResolution
} from '../../../../shared/runtime-file-contracts'

// A folder a server's terminal printed under its temp dir: listed through the folder's grant, each
// file read through a grant of its own that the server checks lies inside the folder.

export type TerminalArtifactFolder = {
  environmentId: string
  worktreeId: string
  /** The server's canonical path; the folder's grant is bound to it. */
  absolutePath: string
  grantId: string
}

export type TerminalArtifactFileGrant = { absolutePath: string; grantId: string }

const CHUNK_BYTES = 512 * 1024
/** What «Download all» holds in memory to zip; a bigger folder is downloaded file by file. */
export const FOLDER_ZIP_MAX_BYTES = 200 * 1024 * 1024

function call<T>(folder: TerminalArtifactFolder, method: string, params: object): Promise<T> {
  return callHostRoute<T>(
    hostRouteForAuthority({
      endpoint: { kind: 'environment', environmentId: folder.environmentId },
      at: 'local'
    }),
    method,
    { worktree: toRuntimeWorktreeSelector(folder.worktreeId), ...params },
    { timeoutMs: 60_000 }
  )
}

export function listTerminalArtifactFolder(
  folder: TerminalArtifactFolder
): Promise<RuntimeTerminalArtifactDirectoryListing> {
  return call(folder, 'files.listTerminalArtifactDirectory', {
    grantId: folder.grantId,
    absolutePath: folder.absolutePath
  })
}

export async function grantTerminalArtifactFolderFile(
  folder: TerminalArtifactFolder,
  relativePath: string
): Promise<TerminalArtifactFileGrant> {
  const resolved = await call<RuntimeTerminalPathResolution>(
    folder,
    'files.grantTerminalArtifactDirectoryFile',
    { grantId: folder.grantId, absolutePath: folder.absolutePath, relativePath }
  )
  const target = resolved.openTarget
  if (target?.kind !== 'absolute-file') {
    throw new Error(`The server did not grant ${relativePath}`)
  }
  return { absolutePath: target.absolutePath, grantId: target.grantId }
}

/** Every chunk of a granted file, in order. */
async function readChunks(
  folder: TerminalArtifactFolder,
  file: TerminalArtifactFileGrant,
  onChunk: (contentBase64: string) => Promise<void>
): Promise<void> {
  let offset = 0
  for (;;) {
    const chunk = await call<RuntimeFileReadChunkResult>(
      folder,
      'files.readTerminalArtifactChunk',
      {
        grantId: file.grantId,
        absolutePath: file.absolutePath,
        offset,
        length: CHUNK_BYTES
      }
    )
    if (chunk.bytesRead > 0) {
      await onChunk(chunk.contentBase64)
    }
    offset += chunk.bytesRead
    if (chunk.eof) {
      return
    }
    if (chunk.bytesRead <= 0) {
      throw new Error('The download stalled before the end of the file')
    }
  }
}

/** Saves one file where the person picks; false when they cancelled. */
export async function downloadTerminalArtifactFile(
  folder: TerminalArtifactFolder,
  relativePath: string
): Promise<boolean> {
  const file = await grantTerminalArtifactFolderFile(folder, relativePath)
  const download = await window.api.fs.startDownloadedFile({
    suggestedName: relativePath.split('/').pop() || relativePath
  })
  if (download.canceled) {
    return false
  }
  let finished = false
  try {
    await readChunks(folder, file, (contentBase64) =>
      window.api.fs
        .appendDownloadedFileChunk({ transferId: download.transferId, contentBase64 })
        .then(() => {})
    )
    await window.api.fs.finishDownloadedFile({ transferId: download.transferId })
    finished = true
    return true
  } finally {
    if (!finished) {
      await window.api.fs.cancelDownloadedFile({ transferId: download.transferId }).catch(() => {})
    }
  }
}

function base64Bytes(contentBase64: string): Uint8Array {
  const binary = atob(contentBase64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function bytesBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}

/** The whole folder as one zip, its files under their paths in it; false when cancelled. */
export async function downloadTerminalArtifactFolderZip(
  folder: TerminalArtifactFolder,
  relativePaths: readonly string[]
): Promise<boolean> {
  const files: Record<string, Uint8Array> = {}
  for (const relativePath of relativePaths) {
    const file = await grantTerminalArtifactFolderFile(folder, relativePath)
    const parts: Uint8Array[] = []
    await readChunks(folder, file, async (contentBase64) => {
      parts.push(base64Bytes(contentBase64))
    })
    const size = parts.reduce((sum, part) => sum + part.length, 0)
    const whole = new Uint8Array(size)
    let at = 0
    for (const part of parts) {
      whole.set(part, at)
      at += part.length
    }
    files[relativePath] = whole
  }
  const name =
    folder.absolutePath
      .replace(/[\\/]+$/, '')
      .split(/[\\/]/)
      .pop() || 'folder'
  const saved = await window.api.fs.saveDownloadedFile({
    suggestedName: `${name}.zip`,
    content: bytesBase64(zipSync(files)),
    encoding: 'base64'
  })
  return !saved.canceled
}
