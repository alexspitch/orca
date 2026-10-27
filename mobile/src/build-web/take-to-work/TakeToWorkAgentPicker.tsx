import { Text } from 'react-native'
import { MutedText, ui } from '../issue/issue-card-ui'
import { TakeToWorkChoice, TakeToWorkField } from './TakeToWorkFormParts'
import type { ClaudeLaunchAccount } from './use-claude-launch-accounts'

/** Claude in the host's selected account, or in one of its other accounts for this session only. */
export function TakeToWorkAgentPicker({
  accounts,
  value,
  onChange
}: {
  accounts: ClaudeLaunchAccount[]
  value: string | undefined
  onChange: (accountId: string | undefined) => void
}) {
  if (!accounts.length) {
    return (
      <Text style={ui.body}>
        <Text style={ui.muted}>Agent: </Text>
        Claude Code
      </Text>
    )
  }
  return (
    <TakeToWorkField label="Agent">
      <TakeToWorkChoice
        title="Claude Code"
        selected={value === undefined}
        onPress={() => onChange(undefined)}
      />
      {accounts.map((account) => (
        <TakeToWorkChoice
          key={account.id}
          title={`Claude Code — ${account.label}`}
          selected={value === account.id}
          onPress={() => onChange(account.id)}
        />
      ))}
      <MutedText>
        Another account runs this session only; the host&apos;s selected account stays as it is.
      </MutedText>
    </TakeToWorkField>
  )
}
