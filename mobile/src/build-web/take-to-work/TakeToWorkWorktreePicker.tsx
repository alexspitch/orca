import { useMemo, useState } from 'react'
import { Text, View } from 'react-native'
import type { TakeToWorkWorktree } from './build-web-take-to-work'
import { TakeToWorkChoice, TakeToWorkInput, partStyles } from './TakeToWorkFormParts'

const SEARCH_FROM = 6

/** The desktop's workspace combobox: the candidates, filtered by name once there are many. */
export function TakeToWorkWorktreePicker({
  worktrees,
  repoNames,
  value,
  onChange
}: {
  worktrees: TakeToWorkWorktree[]
  repoNames: ReadonlyMap<string, string>
  value: string | null
  onChange: (worktreeId: string) => void
}) {
  const [query, setQuery] = useState('')
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return needle
      ? worktrees.filter((w) =>
          `${w.displayName} ${w.branch ?? ''} ${repoNames.get(w.repoId) ?? ''}`
            .toLowerCase()
            .includes(needle)
        )
      : worktrees
  }, [query, repoNames, worktrees])
  return (
    <View style={partStyles.field}>
      {worktrees.length > SEARCH_FROM ? (
        <TakeToWorkInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search worktrees"
          accessibilityLabel="Search worktrees"
        />
      ) : null}
      {shown.map((w) => (
        <TakeToWorkChoice
          key={w.worktreeId}
          title={w.displayName}
          detail={[repoNames.get(w.repoId), w.branch].filter(Boolean).join(' · ')}
          selected={w.worktreeId === value}
          onPress={() => onChange(w.worktreeId)}
        />
      ))}
      {shown.length === 0 ? <Text style={partStyles.hint}>No worktree matches.</Text> : null}
    </View>
  )
}
