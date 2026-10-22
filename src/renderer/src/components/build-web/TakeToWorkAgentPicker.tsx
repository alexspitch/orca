import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { translate } from '@/i18n/i18n'
import type { ClaudeLaunchAccount } from '../tab-bar/use-claude-launch-accounts'

// Why a sentinel: a Select item cannot carry an empty value.
const HOST_SELECTION = 'host-selection'

/** Claude in the host's selected account, or in one of its other accounts for this session only. */
export function TakeToWorkAgentPicker({
  accounts,
  value,
  onChange
}: {
  accounts: ClaudeLaunchAccount[]
  value: string | undefined
  onChange: (accountId: string | undefined) => void
}): React.JSX.Element {
  const claude = translate('buildWeb.take.claude', 'Claude Code')
  if (!accounts.length) {
    return (
      <p className="text-sm">
        <span className="text-muted-foreground">{translate('buildWeb.take.agent', 'Agent')}: </span>
        {claude}
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="take-agent" className="text-sm font-medium">
        {translate('buildWeb.take.agent', 'Agent')}
      </label>
      <Select
        value={value ?? HOST_SELECTION}
        onValueChange={(next) => onChange(next === HOST_SELECTION ? undefined : next)}
      >
        <SelectTrigger id="take-agent" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={HOST_SELECTION}>{claude}</SelectItem>
          {accounts.map((account) => (
            <SelectItem key={account.id} value={account.id}>
              {translate('buildWeb.take.claudeAccount', 'Claude Code — {{account}}', {
                account: account.label
              })}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        {translate(
          'buildWeb.take.agentHint',
          "Another account runs this session only; the host's selected account stays as it is."
        )}
      </p>
    </div>
  )
}
