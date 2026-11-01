import { lstat, readdir, realpath } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import type {
  RuntimeFileReadChunkResult,
  RuntimeTerminalArtifactDirectoryListing
} from '../../../../shared/runtime-file-contracts'
import { isPathInsideOrEqual } from '../../../../shared/cross-platform-path'
import { isSafeMobileRelativePath } from '../../files/mobile-file-kind'
import type { TerminalFileGrant } from './file-grants'
import { assertTerminalFileGrantFresh } from './artifact-integrity'
import { openLocalTerminalArtifactGrant } from './local-artifact-read'

// A folder under the host's temp dir that a terminal printed (an agent's scratchpad, say): its
// files are listed and each is granted on its own, so nothing outside the folder is reachable.

const MAX_FILES = 1000
const MAX_DEPTH = 6
const MAX_CHUNK_BYTES = 512 * 1024

/** The folder's files, walked without following links; hard-linked files are left out like a tap. */
export async function listTerminalArtifactDirectory(
  root: string
): Promise<RuntimeTerminalArtifactDirectoryListing> {
  const entries: RuntimeTerminalArtifactDirectoryListing['entries'] = []
  let truncated = false
  const walk = async (dir: string, depth: number): Promise<void> => {
    const names = await readdir(dir, { withFileTypes: true }).catch(() => [])
    names.sort((a, b) => a.name.localeCompare(b.name))
    for (const entry of names) {
      if (entries.length >= MAX_FILES) {
        truncated = true
        return
      }
      const path = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (depth >= MAX_DEPTH) {
          truncated = true
          continue
        }
        await walk(path, depth + 1)
      } else if (entry.isFile()) {
        const stats = await lstat(path).catch(() => null)
        if (stats?.isFile() && stats.nlink <= 1) {
          entries.push({
            relativePath: relative(root, path).split(sep).join('/'),
            size: stats.size
          })
        }
      }
    }
  }
  await walk(root, 0)
  return { entries, truncated }
}

/** The file `relativePath` names under the granted folder, resolved; null when it leaves it or is not a plain file. */
export async function terminalArtifactDirectoryFile(
  grant: TerminalFileGrant,
  relativePath: string
): Promise<string | null> {
  if (!isSafeMobileRelativePath(relativePath)) {
    return null
  }
  const candidate = join(grant.absolutePath, ...relativePath.split('/'))
  const resolved = await realpath(candidate).catch(() => null)
  if (!resolved || resolved !== candidate || !isPathInsideOrEqual(grant.absolutePath, resolved)) {
    return null
  }
  const stats = await lstat(resolved).catch(() => null)
  return stats?.isFile() ? resolved : null
}

/** One slice of a granted file, for a download; a file changed since its grant refuses. */
export async function readTerminalArtifactChunk(
  grant: TerminalFileGrant,
  offset: number,
  length: number
): Promise<RuntimeFileReadChunkResult> {
  if (grant.isDirectory) {
    throw new Error('Cannot read a directory')
  }
  const handle = await openLocalTerminalArtifactGrant(grant, 0)
  try {
    const stats = await handle.stat()
    assertTerminalFileGrantFresh(grant, stats)
    const size = Math.max(0, Math.min(length, MAX_CHUNK_BYTES))
    const buffer = Buffer.alloc(size)
    const { bytesRead } = await handle.read(buffer, 0, size, offset)
    return {
      contentBase64: buffer.subarray(0, bytesRead).toString('base64'),
      bytesRead,
      eof: offset + bytesRead >= stats.size
    }
  } finally {
    await handle.close()
  }
}
