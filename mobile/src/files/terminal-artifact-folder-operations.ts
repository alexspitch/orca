import { z } from 'zod'
import type {
  RuntimeTerminalArtifactDirectoryListing,
  RuntimeTerminalPathResolution
} from '../../../src/shared/runtime-file-contracts'
import { defineRpcOperation, runRpcOperation } from '../transport/rpc-operation'
import { rpcResultVariant } from '../transport/rpc-operation-result-reader'
import type { UnvalidatedRpcRequestPort } from '../transport/unvalidated-rpc-request-port'

// A server folder a terminal printed (an agent's scratchpad): listed through its grant, each file
// granted on its own for the preview.

export type TerminalArtifactFolderRoute = {
  worktreeId: string
  absolutePath: string
  grantId: string
}

const listFolder = defineRpcOperation({
  name: 'files.listTerminalArtifactDirectory',
  method: 'files.listTerminalArtifactDirectory',
  acceptance: 'require-result-or-throw-message',
  barrier: 'on-settle',
  read: rpcResultVariant(
    'terminal-artifact-folder',
    z.custom<RuntimeTerminalArtifactDirectoryListing>(
      (value) => typeof value === 'object' && value !== null && 'entries' in value
    )
  )
})

const grantFolderFile = defineRpcOperation({
  name: 'files.grantTerminalArtifactDirectoryFile',
  method: 'files.grantTerminalArtifactDirectoryFile',
  acceptance: 'require-result-or-throw-message',
  barrier: 'on-settle',
  read: rpcResultVariant(
    'terminal-artifact-folder-file',
    z.custom<RuntimeTerminalPathResolution>((value) => typeof value === 'object' && value !== null)
  )
})

export function listTerminalArtifactFolder(
  client: UnvalidatedRpcRequestPort,
  folder: TerminalArtifactFolderRoute
): Promise<RuntimeTerminalArtifactDirectoryListing> {
  return runRpcOperation(client, listFolder, {
    worktree: `id:${folder.worktreeId}`,
    grantId: folder.grantId,
    absolutePath: folder.absolutePath
  })
}

/** The file's own grant, for the terminal-artifact preview. */
export async function grantTerminalArtifactFolderFile(
  client: UnvalidatedRpcRequestPort,
  folder: TerminalArtifactFolderRoute,
  relativePath: string
): Promise<{ absolutePath: string; grantId: string }> {
  const resolved = await runRpcOperation(client, grantFolderFile, {
    worktree: `id:${folder.worktreeId}`,
    grantId: folder.grantId,
    absolutePath: folder.absolutePath,
    relativePath
  })
  const target = resolved.openTarget
  if (target?.kind !== 'absolute-file') {
    throw new Error(`The server did not grant ${relativePath}`)
  }
  return { absolutePath: target.absolutePath, grantId: target.grantId }
}
