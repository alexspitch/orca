import type {
  ClaudeRateLimitAccountsState,
  CodexRateLimitAccountsState
} from '../../../../shared/managed-account-types'
import type {
  InactiveAccountUsage,
  ProviderRateLimits,
  RateLimitState
} from '../../../../shared/rate-limit-types'
import { translate } from '@/i18n/i18n'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import {
  getClaudeStatusActiveId,
  resolveClaudeStatusAccountState
} from './status-bar-claude-accounts'
import { getCodexStatusActiveId, resolveCodexStatusAccountState } from './status-bar-codex-accounts'
import { createPendingProviderSnapshot } from './status-bar-provider-visibility'

/** One footer meter. `key` is unique per chip; an account's chip names that account. */
export type UsageChip = { key: string; p: ProviderRateLimits; accountLabel: string | null }

/** The usage host's own account rosters, which name its account chips. */
export type UsageChipAccounts = {
  claude: ClaudeRateLimitAccountsState
  codex: CodexRateLimitAccountsState
}

/** This computer's rosters, from Settings as the switchers read them. */
export function localUsageChipAccounts(
  settings: GlobalSettings | null | undefined
): UsageChipAccounts {
  return {
    claude: resolveClaudeStatusAccountState(
      settings,
      { accounts: [], activeAccountId: null },
      null
    ),
    codex: resolveCodexStatusAccountState(settings, { accounts: [], activeAccountId: null }, null)
  }
}

type ChipAccount = { id: string; email: string; label?: string | null }

// Why short: the footer is one line; the switcher and Settings show the full identity.
function chipLabel(account: ChipAccount): string {
  return account.label?.trim() || account.email.split('@')[0] || account.email
}

function accountChips(
  active: ProviderRateLimits,
  accounts: readonly ChipAccount[],
  activeId: string | null,
  inactive: readonly InactiveAccountUsage[],
  stale: boolean
): UsageChip[] {
  const byId = new Map(accounts.map((account) => [account.id, account]))
  const activeAccount = activeId ? byId.get(activeId) : undefined
  const activeChip: UsageChip = {
    key: active.provider,
    p: active,
    accountLabel: activeAccount
      ? chipLabel(activeAccount)
      : translate('auto.components.status.bar.StatusBar.systemDefaultAccountChip', 'default')
  }
  const others = inactive.flatMap((entry): UsageChip[] => {
    const account = byId.get(entry.accountId)
    const p =
      entry.rateLimits ??
      (entry.isFetching && !stale ? createPendingProviderSnapshot(active.provider) : null)
    if (!account || !p) {
      return []
    }
    // Why: an unreachable host's last numbers stay, marked stale like its active chip.
    const shown = stale && p.status !== 'error' ? { ...p, status: 'error' as const } : p
    return [
      { key: `${active.provider}:${entry.accountId}`, p: shown, accountLabel: chipLabel(account) }
    ]
  })
  return [activeChip, ...others]
}

/**
 * The footer's meters: one per provider, or with `allAccounts` one per Claude and Codex account on
 * the usage host, its active account first. An account active in another runtime (a WSL distro)
 * has no reading on this host and gets no chip.
 */
export function buildUsageChips(
  roster: readonly ProviderRateLimits[],
  options: {
    allAccounts: boolean
    /** Null while a remote host's rosters are pending: its accounts cannot be named yet. */
    accounts: UsageChipAccounts | null
    rateLimits: Pick<
      RateLimitState,
      'claudeTarget' | 'codexTarget' | 'inactiveClaudeAccounts' | 'inactiveCodexAccounts'
    >
    stale: boolean
  }
): UsageChip[] {
  const { allAccounts, accounts, rateLimits, stale } = options
  return roster.flatMap((p): UsageChip[] => {
    if (!allAccounts || !accounts) {
      return [{ key: p.provider, p, accountLabel: null }]
    }
    if (p.provider === 'claude') {
      const activeId = getClaudeStatusActiveId(accounts.claude, rateLimits.claudeTarget)
      return accountChips(
        p,
        accounts.claude.accounts,
        activeId,
        rateLimits.inactiveClaudeAccounts,
        stale
      )
    }
    if (p.provider === 'codex') {
      const activeId = getCodexStatusActiveId(accounts.codex, rateLimits.codexTarget)
      return accountChips(
        p,
        accounts.codex.accounts,
        activeId,
        rateLimits.inactiveCodexAccounts,
        stale
      )
    }
    return [{ key: p.provider, p, accountLabel: null }]
  })
}
