import type { GlobalSettings } from '../../shared/global-settings-types'
import { CLAUDE_LAUNCH_ACCOUNT_ENV } from '../../shared/claude-launch-account'
import {
  CLAUDE_INJECTED_CONFIG_DIR_ENV,
  CLAUDE_PROFILE_POINTER_ENV,
  CLAUDE_USER_CONFIG_DIR_ENV
} from '../../shared/claude-profile-routing'
import { getClaudeProfileRouter } from './claude-profile-installed-router'
import type { ClaudeProfileRouter } from './claude-profile-router'
import { findClaudeAccount, type ClaudeAccountSelectionTarget } from './runtime-selection'

// Why gone: with the pointer, the pane's `claude` function follows the host's selection instead.
const ROUTING_ENV = [
  CLAUDE_PROFILE_POINTER_ENV,
  CLAUDE_INJECTED_CONFIG_DIR_ENV,
  CLAUDE_USER_CONFIG_DIR_ENV,
  CLAUDE_LAUNCH_ACCOUNT_ENV
]

type LaunchAccountRouter = Pick<
  ClaudeProfileRouter,
  'envReady' | 'coveredBySystemDefault' | 'userConfigDir' | 'prepareAccount'
>

/**
 * A pane started for one named account: its folder, set up like a selected one's, in place of the
 * host's routing. Null when the pane names none. Throws rather than run another account.
 */
export async function applyClaudeLaunchAccount(
  env: Record<string, string> | undefined,
  target: ClaudeAccountSelectionTarget,
  getSettings: (() => Pick<GlobalSettings, 'claudeManagedAccounts'> | undefined) | undefined,
  router: LaunchAccountRouter | undefined = getClaudeProfileRouter()
): Promise<{ env: Record<string, string>; envToDelete: string[] } | null> {
  const accountId = env?.[CLAUDE_LAUNCH_ACCOUNT_ENV]
  if (!env || !accountId) {
    return null
  }
  const settings = getSettings?.()
  // Why not WSL: a distro pane's folder is the guest's, which only its own router can set up.
  if (!router || !settings || target.runtime === 'wsl') {
    throw new Error('This host cannot start Claude with another account.')
  }
  if (!findClaudeAccount(settings, accountId)) {
    throw new Error('That Claude account is no longer on this host.')
  }
  await router.envReady
  const rest = Object.fromEntries(Object.entries(env).filter(([key]) => !ROUTING_ENV.includes(key)))
  if (router.coveredBySystemDefault(accountId)) {
    // Why no folder: naming System default's own folder moves Claude to another Keychain item.
    const own = router.userConfigDir()
    if (own) {
      return { env: { ...rest, CLAUDE_CONFIG_DIR: own }, envToDelete: ROUTING_ENV }
    }
    const { CLAUDE_CONFIG_DIR: _routed, ...withoutConfigDir } = rest
    return { env: withoutConfigDir, envToDelete: [...ROUTING_ENV, 'CLAUDE_CONFIG_DIR'] }
  }
  const home = await router.prepareAccount(accountId)
  return { env: { ...rest, CLAUDE_CONFIG_DIR: home }, envToDelete: ROUTING_ENV }
}
