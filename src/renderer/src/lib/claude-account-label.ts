import type { ClaudeRateLimitAccountsState } from '../../../shared/managed-account-types'

/** Display label for a selected Claude account row; null is System default. */
export function getClaudeAccountLabel(
  state: Pick<ClaudeRateLimitAccountsState, 'accounts'>,
  accountId: string | null | undefined
): string {
  if (accountId == null) {
    return 'System default'
  }
  const account = state.accounts.find((candidate) => candidate.id === accountId)
  return account?.label || account?.email || 'Claude account'
}
