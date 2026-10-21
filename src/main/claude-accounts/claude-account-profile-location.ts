import type { ClaudeManagedAccount } from '../../shared/managed-account-types'
import { removeClaudeAccountFolder } from './claude-account-folder'
import {
  describeExternalClaudeProfile,
  externalClaudeConfigDirs,
  isExternalClaudeConfigDirPresent,
  removeExternalClaudeProfileHooks,
  savedExternalClaudeConfigDir
} from './claude-external-config-dir'
import { isDirectory, listClaudeProfileHomes } from './claude-profile-installed-router'
import { describeClaudeProfile, type ClaudeProfileDescriptor } from './claude-profile-paths'

/** Where a host account's launches run: its own folder under dataRoot, or the user's saved one. */
export function describeClaudeAccountProfile(
  dataRoot: string,
  accounts: readonly ClaudeManagedAccount[],
  accountId: string
): ClaudeProfileDescriptor {
  const external = savedExternalClaudeConfigDir(accounts, accountId)
  return external
    ? describeExternalClaudeProfile(accountId, external)
    : describeClaudeProfile(dataRoot, accountId, { executionHostId: 'local', runtime: 'host' })
}

export function isClaudeAccountHomePresent(profile: ClaudeProfileDescriptor): boolean {
  return profile.external
    ? isExternalClaudeConfigDirPresent(profile.home)
    : isDirectory(profile.home)
}

export function listClaudeAccountHomes(
  dataRoot: string,
  accounts: readonly ClaudeManagedAccount[]
): string[] {
  const external = externalClaudeConfigDirs(accounts).filter(isExternalClaudeConfigDirPresent)
  return [...listClaudeProfileHomes(dataRoot), ...external]
}

/** A managed folder is deleted with its sign-in; the user's own folder only loses Orca's hooks. */
export async function removeClaudeAccountProfile(
  dataRoot: string,
  profile: ClaudeProfileDescriptor
): Promise<void> {
  if (profile.external) {
    removeExternalClaudeProfileHooks(profile.home)
    return
  }
  await removeClaudeAccountFolder(dataRoot, profile.accountId)
}
