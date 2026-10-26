import type { ClaudeManagedAccountSummary } from '../../../../shared/managed-account-types'
import { formatAccountTimestamp } from './accounts-pane-runtime'
import type { AccountsPaneSectionModel } from './accounts-pane-types'
import { ClaudeAccountNamePopover } from './claude-account-name-popover'
import { ClaudeFolderAccountPopover } from './claude-folder-account-popover'

// Custom build: the Claude accounts section's own controls, fed from the section model.

/** Adds a Claude folder already signed in on the account host; also on a server, named there. */
export function ClaudeFolderAction({
  model
}: {
  model: AccountsPaneSectionModel
}): React.JSX.Element {
  const { claudeAction, wslCapabilitiesLoading, accountRuntimeUnavailable, accountRuntime } = model
  return (
    <ClaudeFolderAccountPopover
      owner={model.accountOwner}
      hostLabel={model.accountRuntimeSentenceLabel}
      disabled={
        claudeAction !== 'idle' ||
        wslCapabilitiesLoading ||
        accountRuntimeUnavailable ||
        accountRuntime.runtime !== 'host'
      }
      busy={claudeAction === 'adding-folder'}
      runClaudeAccountAction={model.runClaudeAccountAction}
    />
  )
}

export function ClaudeNameAction({
  model,
  account,
  disabled
}: {
  model: AccountsPaneSectionModel
  account: Pick<ClaudeManagedAccountSummary, 'id' | 'email' | 'label'>
  disabled: boolean
}): React.JSX.Element {
  return (
    <ClaudeAccountNamePopover
      owner={model.accountOwner}
      account={account}
      disabled={disabled}
      busy={model.claudeAction === `rename:${account.id}`}
      runClaudeAccountAction={model.runClaudeAccountAction}
    />
  )
}

/** A named account shows its email here; a saved folder shows where it lives. */
export function claudeAccountDetail(
  account: Pick<
    ClaudeManagedAccountSummary,
    'label' | 'email' | 'organizationName' | 'externalConfigDir' | 'lastAuthenticatedAt'
  >
): string {
  return [
    account.label ? account.email : null,
    account.organizationName,
    account.externalConfigDir,
    formatAccountTimestamp(account.lastAuthenticatedAt)
  ]
    .filter(Boolean)
    .join(' · ')
}
