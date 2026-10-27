import { useEffect, useState } from 'react'
import { CLAUDE_LAUNCH_ACCOUNT_RUNTIME_CAPABILITY } from '../../../../src/shared/account-runtime-capabilities'
import { AGENT_LAUNCH_SURFACE_RUNTIME_CAPABILITY } from '../../../../src/shared/agent-launch-runtime-capability'
import { decodeAccountsSnapshot } from '../../components/AccountUsage'
import { homeHostAccountsRead } from '../../home/mobile-home-host-operations'
import type { RpcClient } from '../../transport/rpc-client'

export type ClaudeLaunchAccount = { id: string; label: string }

/**
 * The host's Claude accounts a plain launch does not already run: every one but its selection,
 * as the desktop's useClaudeLaunchAccounts. None on a host that cannot start one per launch, or
 * cannot force the terminal the account is honored on.
 */
export function useClaudeLaunchAccounts(
  client: RpcClient,
  hostCapabilities: readonly string[]
): ClaudeLaunchAccount[] {
  const usable =
    hostCapabilities.includes(CLAUDE_LAUNCH_ACCOUNT_RUNTIME_CAPABILITY) &&
    hostCapabilities.includes(AGENT_LAUNCH_SURFACE_RUNTIME_CAPABILITY)
  const [accounts, setAccounts] = useState<ClaudeLaunchAccount[]>([])
  useEffect(() => {
    if (!usable) {
      return
    }
    let alive = true
    void (async () => {
      try {
        const reply = homeHostAccountsRead.interpret(await homeHostAccountsRead.request(client))
        if (!reply.accepted || !alive) {
          return
        }
        const { claude } = decodeAccountsSnapshot(reply.value)
        const selected = claude.activeAccountIdsByRuntime?.host ?? claude.activeAccountId
        setAccounts(
          claude.accounts
            .filter((account) => account.managedAuthRuntime !== 'wsl' && account.id !== selected)
            .map((account) => ({ id: account.id, label: account.email }))
        )
      } catch {
        // A roster that cannot be read offers only the host's selection.
      }
    })()
    return () => {
      alive = false
    }
  }, [client, usable])
  return usable ? accounts : []
}
