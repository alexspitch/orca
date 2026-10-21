import { mkdirSync, rmSync, statSync } from 'node:fs'
import { dirname, isAbsolute } from 'node:path'
import {
  isAgentStatusHooksEnabledForAgent,
  type AgentStatusHooksSettings
} from '../../shared/agent-status-hooks-setting'
import { removeExternalClaudeProfileHooks } from '../claude-accounts/claude-external-config-dir'
import { writeFileAtomically } from '../codex-accounts/fs-utils'
import { resolveClaudeCommand } from '../codex-cli/command'
import { probeRecentClaudeCliVersion } from './claude-hook-event-versions'
import { CLAUDE_HOOK_SETTINGS } from './hook-settings'
import type { ClaudeHookService } from './hook-service'
import { removeStatusLineInstallMarker } from './statusline-install'
import {
  claudeUserConfigDirRegistryPath as registryPath,
  readClaudeUserConfigDirs
} from './claude-user-config-dir-registry'

export { readClaudeUserConfigDirs }

/*
 * Folders a pane's `claude` ran in by the user's own CLAUDE_CONFIG_DIR (an alias, a one-off export).
 * Orca merges its hooks and usage status line into each before Claude starts, and remembers them so
 * turning Claude hooks off takes them back out.
 */

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

/** Never throws: a failure only leaves that launch without Orca's hooks, as before. */
export async function prepareClaudeUserConfigDir(
  service: ClaudeHookService,
  configDir: string,
  hooksEnabled: () => boolean
): Promise<void> {
  try {
    // Why: Claude creates a missing folder itself; Orca only edits one the user already has.
    if (!hooksEnabled() || !isAbsolute(configDir) || !isDirectory(configDir)) {
      return
    }
    const claudeVersion = await probeRecentClaudeCliVersion(resolveClaudeCommand())
    if (!hooksEnabled()) {
      return
    }
    const status = service.install({
      configDir,
      claudeVersion: claudeVersion ?? undefined,
      userFolder: true
    })
    const dirs = readClaudeUserConfigDirs()
    if (status.state === 'installed' && !dirs.includes(configDir)) {
      const path = registryPath()
      mkdirSync(dirname(path), { recursive: true })
      writeFileAtomically(path, `${JSON.stringify([...dirs, configDir], null, 2)}\n`)
    }
  } catch (error) {
    console.warn('[claude-hooks] Could not prepare a Claude folder for this launch:', error)
  }
}

/** Lets a pane's `claude` ask this host to prepare the user's own folder before it starts. */
export function listenForClaudeUserConfigDirs(
  server: {
    setClaudeConfigDirListener(listener: ((configDir: string) => Promise<void>) | null): void
  },
  service: ClaudeHookService,
  getSettings: () => AgentStatusHooksSettings
): () => void {
  server.setClaudeConfigDirListener((configDir) =>
    prepareClaudeUserConfigDir(service, configDir, () =>
      isAgentStatusHooksEnabledForAgent(getSettings(), 'claude')
    )
  )
  return () => server.setClaudeConfigDirListener(null)
}

export function removeClaudeUserConfigDirHooks(): void {
  for (const configDir of readClaudeUserConfigDirs()) {
    removeExternalClaudeProfileHooks(configDir)
    removeStatusLineInstallMarker(CLAUDE_HOOK_SETTINGS, configDir)
  }
  try {
    rmSync(registryPath(), { force: true })
  } catch {
    // Best-effort: a stale entry is only revisited by the next removal.
  }
}
