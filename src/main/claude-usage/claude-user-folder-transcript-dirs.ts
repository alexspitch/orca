import { join } from 'node:path'
import {
  getClaudeProfileRouter,
  isDirectory
} from '../claude-accounts/claude-profile-installed-router'
import { readClaudeUserConfigDirs } from '../claude/claude-user-config-dir-registry'

/**
 * History in the user's own Claude folders: System default's CLAUDE_CONFIG_DIR and folders a pane's
 * `claude` ran in by an alias or export. Resolved by the host; a scan worker has no router or registry.
 */
export function claudeUserFolderTranscriptDirs(): string[] {
  const userConfigDir = getClaudeProfileRouter()?.userConfigDir()
  const folders = [...(userConfigDir ? [userConfigDir] : []), ...readClaudeUserConfigDirs()]
  return folders
    .flatMap((folder) => [join(folder, 'projects'), join(folder, 'transcripts')])
    .filter(isDirectory)
}
