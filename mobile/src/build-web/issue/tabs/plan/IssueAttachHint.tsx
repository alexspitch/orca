import { StyleSheet, Text, View } from 'react-native'
import { colors, radii, spacing, typography } from '../../../../theme/mobile-theme'

/** How to attach what an empty tab is for, as build-web says it. */
export function IssueAttachHint({ text, command }: { text: string; command: string }) {
  return (
    <View style={styles.hint}>
      <Text style={styles.text}>{text}</Text>
      <Text selectable style={styles.command}>
        {command}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  hint: {
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderSubtle,
    borderRadius: radii.row,
    paddingHorizontal: spacing.lg,
    paddingVertical: 40
  },
  text: { color: colors.textSecondary, fontSize: typography.bodySize, textAlign: 'center' },
  command: {
    color: colors.textSecondary,
    fontFamily: typography.monoFamily,
    fontSize: typography.metaSize,
    textAlign: 'center'
  }
})
