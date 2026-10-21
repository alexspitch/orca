import { statSync } from 'node:fs'
import { homedir } from 'node:os'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import type { ClaudeManagedAccount } from '../../shared/managed-account-types'
import { readHooksJson } from '../agent-hooks/hooks-json-read'
import { writeHooksJson } from '../agent-hooks/installer-utils'
import {
  getConfigPath,
  getManagedScriptFileName,
  removeManagedHooks
} from '../claude/hook-settings'
import {
  assertOutsideDefaultClaudeHomes,
  type ClaudeProfileDescriptor
} from './claude-profile-paths'

/*
 * A Claude config folder the user signed in to themselves, saved as an account by reference.
 * Launches run there and setup merges Orca's hooks into it; nothing is copied, linked or deleted,
 * and Claude renews its own login there, so no credential is ever duplicated.
 */

function externalConfigDirOf(account: ClaudeManagedAccount): string | null {
  // Why host only: only this host's router routes to it; WSL accounts live in the guest.
  return account.managedAuthRuntime === 'wsl' ? null : account.externalConfigDir?.trim() || null
}

export function savedExternalClaudeConfigDir(
  accounts: readonly ClaudeManagedAccount[],
  accountId: string
): string | null {
  const account = accounts.find((entry) => entry.id === accountId)
  return account ? externalConfigDirOf(account) : null
}

export function externalClaudeConfigDirs(accounts: readonly ClaudeManagedAccount[]): string[] {
  return accounts.flatMap((account) => externalConfigDirOf(account) ?? [])
}

export function describeExternalClaudeProfile(
  accountId: string,
  configDir: string
): ClaudeProfileDescriptor {
  return {
    version: 1,
    accountId,
    target: { executionHostId: 'local', runtime: 'host' },
    home: configDir,
    external: true
  }
}

/** Follows links, unlike a managed folder's check: the user's own folder may well be one. */
export function isExternalClaudeConfigDirPresent(configDir: string): boolean {
  try {
    return statSync(configDir).isDirectory()
  } catch {
    return false
  }
}

function overlaps(left: string, right: string): boolean {
  return [relative(left, right), relative(right, left)].some(
    (suffix) =>
      suffix === '' || (suffix !== '..' && !suffix.startsWith(`..${sep}`) && !isAbsolute(suffix))
  )
}

/**
 * The spelling saved and passed as CLAUDE_CONFIG_DIR (on macOS Claude keys its Keychain item by
 * it). Throws a message for the user when the folder cannot be an account of its own.
 */
export function resolveExternalClaudeConfigDir(
  input: string,
  context: { dataRoot: string; userHome?: string; userConfigDir?: string }
): string {
  const userHome = context.userHome ?? homedir()
  const trimmed = input.trim()
  const expanded =
    trimmed === '~'
      ? userHome
      : /^~[/\\]/.test(trimmed)
        ? join(userHome, trimmed.slice(2))
        : trimmed
  if (!isAbsolute(expanded)) {
    throw new Error('Enter the absolute path of a folder on the Orca host.')
  }
  const configDir = resolve(expanded)
  if (!isExternalClaudeConfigDirPresent(configDir)) {
    throw new Error(`There is no folder at ${configDir} on the Orca host.`)
  }
  if (overlaps(configDir, join(context.dataRoot, 'claude-profiles'))) {
    throw new Error("That folder belongs to Orca's own Claude accounts.")
  }
  try {
    assertOutsideDefaultClaudeHomes(configDir, userHome, context.userConfigDir)
  } catch {
    throw new Error(
      'That folder is, contains, or sits inside your System default Claude folder. Use System default for that login instead.'
    )
  }
  return configDir
}

/** Takes Orca's hooks back out on removal; never throws, so the account is always forgotten. */
export function removeExternalClaudeProfileHooks(configDir: string): void {
  try {
    const configPath = getConfigPath(undefined, configDir)
    const config = readHooksJson(configPath)
    if (!config) {
      return
    }
    const { config: next, changed } = removeManagedHooks(config, getManagedScriptFileName())
    if (changed) {
      writeHooksJson(configPath, next, { preserveMode: true })
    }
  } catch (error) {
    console.warn('[claude-profile] Could not remove Orca hooks from a Claude folder:', error)
  }
}
