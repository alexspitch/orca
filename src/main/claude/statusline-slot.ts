import { isPlainObject, type HooksConfig } from '../agent-hooks/installer-utils'
import { getStatusLineSlotState, removeManagedStatusLine } from './hook-settings'

export function getStatusLineCommand(config: HooksConfig): string | null {
  const current = config.statusLine
  return isPlainObject(current) && typeof current.command === 'string' && current.command
    ? current.command
    : null
}

// Why not hook-settings' applyManagedStatusLine: this replaces a user-owned slot, whose command
// the caller has already wrapped for the managed script to run.
export function applyWrappedStatusLine(config: HooksConfig, command: string): HooksConfig {
  // Why: sibling fields such as padding belong to a wrapped user status line.
  const current = isPlainObject(config.statusLine) ? config.statusLine : {}
  return { ...config, statusLine: { ...current, type: 'command', command } }
}

/** `restoreCommand` is the wrapped user command to put back; without one the slot is cleared. */
export function removeManagedStatusLineRestoring(
  config: HooksConfig,
  scriptFileName: string,
  restoreCommand: string | null
): { config: HooksConfig; changed: boolean } {
  const current = config.statusLine
  if (
    !restoreCommand ||
    !isPlainObject(current) ||
    getStatusLineSlotState(config, scriptFileName) !== 'managed'
  ) {
    return removeManagedStatusLine(config, scriptFileName)
  }
  return {
    config: { ...config, statusLine: { ...current, command: restoreCommand } },
    changed: true
  }
}
