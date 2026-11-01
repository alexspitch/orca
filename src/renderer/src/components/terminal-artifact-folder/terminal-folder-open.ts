import { runtimeTargetEnvironmentId } from '@/runtime/runtime-client-target'
import { LOCAL_EXECUTION_HOST_ID } from '../../../../shared/execution-host'
import {
  shouldOpenTerminalFileWithSystemDefault,
  type TerminalFileContext
} from '../terminal-pane/terminal-file-path-mapping'
import { offerTerminalArtifactFolder } from './TerminalArtifactFolderDialog'

/** A folder a terminal printed: a server's granted one lists its files here, a local one opens in the OS. */
export async function openTerminalFolder(
  fileContext: TerminalFileContext,
  worktreeId: string,
  absolutePath: string,
  grantId: string | null
): Promise<void> {
  const environmentId = runtimeTargetEnvironmentId(fileContext.target)
  if (grantId !== null && environmentId) {
    offerTerminalArtifactFolder({ environmentId, worktreeId, absolutePath, grantId })
    return
  }
  if (shouldOpenTerminalFileWithSystemDefault(fileContext)) {
    await window.api.shell.openFilePath(absolutePath, LOCAL_EXECUTION_HOST_ID)
  }
}
