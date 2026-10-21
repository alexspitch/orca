import { useEffect, useState } from 'react'
import { useAppStore } from '@/store'
import { getClaudeAccountLabel } from '@/lib/claude-account-label'
import { getLocalProjectExecutionRuntimeContext } from '@/lib/local-preflight-context'
import { wslHostDistroForTarget } from '@/lib/wsl-host-account-owner'
import { fetchProviderAccountsSnapshot } from '@/runtime/runtime-provider-accounts-client'
import { assertRuntimeEnvironmentCapability } from '@/runtime/runtime-rpc-client'
import { useWorktreeRuntimeTarget } from '@/runtime/use-worktree-runtime-target'
import { CLAUDE_LAUNCH_ACCOUNT_RUNTIME_CAPABILITY } from '../../../../shared/account-runtime-capabilities'
import type { ClaudeRateLimitAccountsState } from '../../../../shared/managed-account-types'

export type ClaudeLaunchAccount = { id: string; label: string }

/** The host's accounts a plain Claude launch does not already run: every one but its selection. */
export function claudeLaunchAccountsOf(state: ClaudeRateLimitAccountsState): ClaudeLaunchAccount[] {
  const selected = state.activeAccountIdsByRuntime?.host ?? state.activeAccountId
  return state.accounts
    .filter((account) => account.managedAuthRuntime !== 'wsl' && account.id !== selected)
    .map((account) => ({ id: account.id, label: getClaudeAccountLabel(state, account.id) }))
}

/**
 * The Claude accounts of the host a workspace runs on, to start one session in, read while
 * `enabled` (the menu is open). None over SSH, which keeps its own login, nor in a WSL lane, whose
 * folders only the distro's router sets up, nor on a server that predates per-launch accounts.
 */
export function useClaudeLaunchAccounts(
  worktreeId: string,
  enabled: boolean
): ClaudeLaunchAccount[] {
  const target = useWorktreeRuntimeTarget(worktreeId)
  const wslLane = useAppStore((s) => {
    const runtime = getLocalProjectExecutionRuntimeContext(s, worktreeId)
    return runtime?.status === 'resolved' && runtime.runtime.kind === 'wsl'
  })
  const wslHost = useAppStore(
    (s) => target !== null && wslHostDistroForTarget(target, s.runtimeEnvironments) !== null
  )
  const usable = enabled && target !== null && !wslLane && !wslHost
  const [read, setRead] = useState<{ target: unknown; accounts: ClaudeLaunchAccount[] } | null>(
    null
  )
  useEffect(() => {
    if (!usable || !target) {
      return
    }
    let alive = true
    void (async () => {
      try {
        if (target.kind === 'environment') {
          await assertRuntimeEnvironmentCapability(
            target.environmentId,
            CLAUDE_LAUNCH_ACCOUNT_RUNTIME_CAPABILITY,
            'This Orca server cannot start Claude with another account yet.'
          )
        }
        const snapshot = await fetchProviderAccountsSnapshot(target)
        // Why: a half that failed to load is an empty stand-in, not this host's roster.
        const accounts = snapshot.failedProviders?.includes('claude')
          ? []
          : claudeLaunchAccountsOf(snapshot.claude)
        if (alive) {
          setRead({ target, accounts })
        }
      } catch {
        if (alive) {
          setRead({ target, accounts: [] })
        }
      }
    })()
    return () => {
      alive = false
    }
  }, [target, usable])
  return usable && read?.target === target ? read.accounts : []
}
