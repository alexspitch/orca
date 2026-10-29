import { StyleSheet, Text, View } from 'react-native'
import { colors } from '../theme/mobile-theme'

/**
 * How many agents run in a workspace, shown from two on, as on the desktop. The host lists only
 * agents in live panes, so every row counts.
 */
export function WorktreeAgentCount({ count }: { count: number }) {
  if (count < 2) {
    return null
  }
  return (
    <View style={styles.circle} accessibilityLabel={`${count} agents running`}>
      <Text style={styles.text}>{count}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  circle: {
    flexShrink: 0,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgRaised
  },
  text: {
    fontSize: 10,
    lineHeight: 12,
    color: colors.textSecondary,
    fontVariant: ['tabular-nums']
  }
})
