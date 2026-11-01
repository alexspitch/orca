import { defineMethod } from '../core'
import { remoteFileContentBudget } from './files-remote-content-budget'
import {
  TerminalArtifactChunk,
  TerminalArtifactDirectoryFile,
  TerminalArtifactFile,
  TerminalArtifactFileWrite
} from '../../../../shared/rpc-contract/files-terminal-artifact-params'

export const FILE_TERMINAL_ARTIFACT_METHODS = [
  defineMethod({
    name: 'files.readTerminalArtifact',
    permission: 'workspace',
    params: TerminalArtifactFile,
    handler: async (params, { runtime, clientId }) =>
      runtime.readTerminalArtifactFile(
        params.worktree,
        params.grantId,
        params.absolutePath,
        clientId
      )
  }),
  defineMethod({
    name: 'files.readTerminalArtifactPreview',
    permission: 'workspace',
    params: TerminalArtifactFile,
    handler: async (params, { runtime, clientId, clientKind, requestId }) => {
      const budget = remoteFileContentBudget(clientKind, requestId)
      return budget === undefined
        ? runtime.readTerminalArtifactPreview(
            params.worktree,
            params.grantId,
            params.absolutePath,
            clientId
          )
        : runtime.readTerminalArtifactPreview(
            params.worktree,
            params.grantId,
            params.absolutePath,
            clientId,
            budget
          )
    }
  }),
  defineMethod({
    name: 'files.listTerminalArtifactDirectory',
    permission: 'workspace',
    params: TerminalArtifactFile,
    handler: async (params, { runtime, clientId }) =>
      runtime.listTerminalArtifactDirectory(
        params.worktree,
        params.grantId,
        params.absolutePath,
        clientId
      )
  }),
  defineMethod({
    name: 'files.grantTerminalArtifactDirectoryFile',
    permission: 'workspace',
    params: TerminalArtifactDirectoryFile,
    handler: async (params, { runtime, clientId }) =>
      runtime.grantTerminalArtifactDirectoryFile(
        params.worktree,
        params.grantId,
        params.absolutePath,
        params.relativePath,
        clientId
      )
  }),
  defineMethod({
    name: 'files.readTerminalArtifactChunk',
    permission: 'workspace',
    params: TerminalArtifactChunk,
    handler: async (params, { runtime, clientId }) =>
      runtime.readTerminalArtifactChunk(
        params.worktree,
        params.grantId,
        params.absolutePath,
        params.offset,
        params.length,
        clientId
      )
  }),
  defineMethod({
    name: 'files.writeTerminalArtifact',
    permission: 'workspace',
    params: TerminalArtifactFileWrite,
    handler: async (params, { runtime, clientId }) =>
      runtime.writeTerminalArtifactFile(
        params.worktree,
        params.grantId,
        params.absolutePath,
        params.content,
        clientId
      )
  })
]
