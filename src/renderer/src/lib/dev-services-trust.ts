import type { AppState } from '@/store/types'
import { hashOrcaHookScript } from './orca-hook-trust'
import { canUseRepoWideTrust, isServicesCommandDisabled } from './ensure-hooks-confirmed'

export type DevServicesTrust = {
  state: 'trusted' | 'untrusted' | 'disabled'
  /** Sent with every call; the host refuses a command whose hash differs. */
  commandHash: string
}

/**
 * Trust for the services command without prompting: polling must never open the trust dialog. Only
 * the panel's Trust button goes through `ensureHooksConfirmed`.
 */
export async function readDevServicesTrust(
  state: AppState,
  repoId: string,
  command: string
): Promise<DevServicesTrust> {
  const commandHash = await hashOrcaHookScript(command)
  const repo = state.repos.find((entry) => entry.id === repoId)
  if (isServicesCommandDisabled(repo)) {
    return { state: 'disabled', commandHash }
  }
  const trusted =
    canUseRepoWideTrust(state, repoId) ||
    state.trustedOrcaHooks[repoId]?.services?.contentHash === commandHash
  return { state: trusted ? 'trusted' : 'untrusted', commandHash }
}
