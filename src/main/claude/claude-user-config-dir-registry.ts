import { readFileSync } from 'node:fs'
import { getSharedManagedScriptPath } from '../agent-hooks/installer-utils'

/** The user's own Claude folders a pane's `claude` ran in (see claude-user-config-dirs.ts). */
export function claudeUserConfigDirRegistryPath(): string {
  return getSharedManagedScriptPath('claude-user-config-dirs.json')
}

export function readClaudeUserConfigDirs(): string[] {
  try {
    const parsed: unknown = JSON.parse(readFileSync(claudeUserConfigDirRegistryPath(), 'utf-8'))
    return Array.isArray(parsed)
      ? parsed.filter((dir): dir is string => typeof dir === 'string')
      : []
  } catch {
    return []
  }
}
