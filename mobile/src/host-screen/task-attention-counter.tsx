import { Pressable, StyleSheet, Text } from 'react-native'
import { CircleAlert } from 'lucide-react-native'
import { isTaskSessionAttention } from '../../../src/shared/sidebar-list/task-session-groups'
import { colors, spacing } from '../theme/mobile-theme'
import type { HostScreenController } from './use-host-screen-controller'

/** IS-147: outside «By task» an attention row keeps its lane; this counts them and opens By task. */
export function TaskAttentionCounter({ controller }: { controller: HostScreenController }) {
  const { displayWorktrees, hostKnowsTasks, settings, state } = controller
  if (!hostKnowsTasks || state.view.groupBy === 'task') {
    return null
  }
  const count = displayWorktrees.filter(isTaskSessionAttention).length
  if (count === 0) {
    return null
  }
  return (
    <Pressable
      style={styles.counter}
      onPress={() => settings.handleGroupChange('task')}
      accessibilityRole="button"
      accessibilityLabel={`${count} ${count === 1 ? 'workspace needs' : 'workspaces need'} attention. Group by task`}
      hitSlop={8}
    >
      <CircleAlert size={14} color={colors.statusAmber} />
      <Text style={styles.count}>{count}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  counter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: spacing.xs
  },
  count: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.statusAmber,
    fontVariant: ['tabular-nums']
  }
})
