import { toast } from 'sonner'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { AgentIcon } from '@/lib/agent-catalog'
import { adoptAgentSessionLaunchVerdict } from '@/lib/agent-session-launch-plan'
import { newAgentLaunchRequestId } from '@/lib/agent-launch-request-id'
import { launchAgentInNewTab } from '@/lib/launch-agent-in-new-tab'
import { translate } from '@/i18n/i18n'
import type { LaunchSource } from '../../../../shared/telemetry-events'
import { useClaudeLaunchAccounts } from './use-claude-launch-accounts'

/**
 * One item per other Claude account of the workspace's host: a terminal running `claude` in that
 * account, while the host's selection — and every other session — stays as it is.
 */
export function ClaudeAccountLaunchItems({
  worktreeId,
  groupId,
  launchSource,
  disabled,
  onFocusTerminal
}: {
  worktreeId: string
  groupId: string
  launchSource?: LaunchSource
  disabled: boolean
  onFocusTerminal: (tabId: string) => void
}): React.JSX.Element[] {
  const accounts = useClaudeLaunchAccounts(worktreeId, true)

  const launch = (accountId: string, label: string): void => {
    const result = launchAgentInNewTab({
      // Why a decided terminal route: only a pane's spawn env carries the account to its host.
      agentSessionLaunchPlan: adoptAgentSessionLaunchVerdict({
        route: 'terminal-tui',
        requestId: newAgentLaunchRequestId(),
        agent: 'claude',
        worktreeId
      }),
      agent: 'claude',
      worktreeId,
      groupId,
      claudeAccountId: accountId,
      ...(launchSource !== undefined ? { launchSource } : {})
    })
    if (!result) {
      toast.error(
        translate('tabBar.claudeAccount.launchFailed', 'Could not start Claude as {{account}}.', {
          account: label
        })
      )
      return
    }
    if (result.surface.kind === 'local-terminal') {
      onFocusTerminal(result.surface.tabId)
    }
  }

  return accounts.map((account) => (
    <DropdownMenuItem
      key={`claude-account:${account.id}`}
      disabled={disabled}
      onSelect={() => launch(account.id, account.label)}
      className="gap-2 rounded-[7px] px-2 py-1.5 text-[12px] leading-5 font-medium"
      title={translate(
        'tabBar.claudeAccount.title',
        'Launch Claude as {{account}} in a new terminal',
        { account: account.label }
      )}
    >
      <AgentIcon agent="claude" size={14} />
      <span className="min-w-0 flex-1 truncate">
        {translate('tabBar.claudeAccount.label', 'Claude — {{account}}', {
          account: account.label
        })}
      </span>
    </DropdownMenuItem>
  ))
}
