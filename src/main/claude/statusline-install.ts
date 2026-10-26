import { createHash } from 'node:crypto'
import { existsSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  getSharedManagedScriptPath,
  writeManagedScript,
  type HooksConfig
} from '../agent-hooks/installer-utils'
import { quotePosixShell } from '../../shared/shell-argument-quoting'
import {
  getStatusLineInstallMarkerPath,
  getStatusLineScriptBaseName,
  getStatusLineScriptFileName,
  getStatusLineScriptPath,
  getStatusLineSlotState,
  type ClaudeCompatibleHookSettings
} from './hook-settings'
import {
  applyWrappedStatusLine,
  getStatusLineCommand,
  removeManagedStatusLineRestoring
} from './statusline-slot'
import { getManagedStatusLineCommand, getManagedStatusLineScript } from './statusline-script'

// Why the settings entry carries it: each Claude folder keeps its own status line, and a profile's
// settings copy brings it along. The managed POSIX script runs it before forwarding usage.
const USER_COMMAND_VAR = 'ORCA_STATUSLINE_USER_COMMAND'
const USER_COMMAND_PREFIX = new RegExp(
  `^${USER_COMMAND_VAR}='((?:[^']|'\\\\'')*)'; export ${USER_COMMAND_VAR}; `
)

export function wrapUserStatusLineCommand(managedCommand: string, userCommand: string): string {
  return `${USER_COMMAND_VAR}=${quotePosixShell(userCommand)}; export ${USER_COMMAND_VAR}; ${managedCommand}`
}

export function readWrappedUserStatusLineCommand(command: string | null): string | null {
  const quoted = command?.match(USER_COMMAND_PREFIX)?.[1]
  return quoted ? quoted.replaceAll("'\\''", "'") : null
}

/** A user folder remembers its own opt-out; undefined is the default home's existing marker. */
function installMarkerPath(settings: ClaudeCompatibleHookSettings, configDir?: string): string {
  if (configDir === undefined) {
    return getStatusLineInstallMarkerPath(settings)
  }
  const folder = createHash('sha256').update(resolve(configDir)).digest('hex').slice(0, 16)
  return getSharedManagedScriptPath(`${getStatusLineScriptBaseName(settings)}.${folder}.installed`)
}

// Why: the statusline feed is opportunistic (usage display, not agent status); a user who deleted the
// managed entry has opted out, and the marker distinguishes that deletion from a first install.
export function installManagedStatusLine(
  config: HooksConfig,
  settings: ClaudeCompatibleHookSettings,
  configDir?: string
): HooksConfig {
  const scriptFileName = getStatusLineScriptFileName(settings)
  const markerPath = installMarkerPath(settings, configDir)
  const slot = getStatusLineSlotState(config, scriptFileName)
  const current = getStatusLineCommand(config)
  const userCommand = slot === 'user' ? current : readWrappedUserStatusLineCommand(current)
  // Why POSIX only for a user command: Windows Claude runs the statusLine under Git Bash or
  // PowerShell, and the managed .cmd cannot re-run a command written for either shell faithfully.
  if (
    (slot === 'user' && process.platform === 'win32') ||
    (slot === 'empty' && existsSync(markerPath))
  ) {
    return config
  }
  const statusLineScriptPath = getStatusLineScriptPath(settings)
  writeManagedScript(statusLineScriptPath, getManagedStatusLineScript('local'))
  const managedCommand = getManagedStatusLineCommand(statusLineScriptPath)
  // Why: a user status line hides the feed, so it runs from the managed script and keeps its output.
  const next = applyWrappedStatusLine(
    config,
    userCommand ? wrapUserStatusLineCommand(managedCommand, userCommand) : managedCommand
  )
  try {
    writeFileSync(markerPath, '')
  } catch {
    // Best-effort: a missing marker only means one future user deletion gets re-installed once.
  }
  return next
}

/** Drops the managed statusLine, putting a wrapped user command back in its place. */
export function uninstallManagedStatusLine(
  config: HooksConfig,
  settings: ClaudeCompatibleHookSettings
): { config: HooksConfig; changed: boolean } {
  return removeManagedStatusLineRestoring(
    config,
    getStatusLineScriptFileName(settings),
    readWrappedUserStatusLineCommand(getStatusLineCommand(config))
  )
}

// Why: a Claude that predates statusLine discards the whole settings file over Orca's; dropping the
// marker with it keeps an upgrade from reading the removal as the user's opt-out.
export function retireManagedStatusLine(
  config: HooksConfig,
  settings: ClaudeCompatibleHookSettings,
  configDir?: string
): HooksConfig {
  const { config: next, changed } = uninstallManagedStatusLine(config, settings)
  if (changed) {
    removeStatusLineInstallMarker(settings, configDir)
  }
  return next
}

/** Forgets a folder's opt-out, so a later install adds the statusline again. */
export function removeStatusLineInstallMarker(
  settings: ClaudeCompatibleHookSettings,
  configDir?: string
): void {
  try {
    rmSync(installMarkerPath(settings, configDir), { force: true })
  } catch {
    // Best-effort: a stale marker only means one install skips re-adding the statusline.
  }
}
