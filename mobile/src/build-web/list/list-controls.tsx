import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text } from 'react-native'
import type { LucideIcon } from 'lucide-react-native'
import { colors, radii, spacing, typography } from '../../theme/mobile-theme'

/** The desktop's outline toggle and select trigger, as one pill: pressed reads as filled. */
export function FilterPill({
  label,
  icon: Icon,
  pressed,
  disabled,
  trailing,
  onPress,
  accessibilityLabel
}: {
  label: string
  icon?: LucideIcon
  pressed?: boolean
  disabled?: boolean
  trailing?: ReactNode
  onPress: () => void
  accessibilityLabel?: string
}) {
  const tint = pressed ? colors.textPrimary : colors.textSecondary
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: Boolean(pressed), disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed: down }) => [
        styles.pill,
        pressed ? styles.pillOn : null,
        disabled ? styles.disabled : null,
        down ? styles.down : null
      ]}
    >
      {Icon ? <Icon size={13} color={tint} /> : null}
      <Text style={[styles.text, { color: tint }]} numberOfLines={1}>
        {label}
      </Text>
      {trailing}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    height: 30,
    paddingHorizontal: spacing.md,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgPanel
  },
  pillOn: { backgroundColor: colors.bgRaised, borderColor: colors.textMuted },
  disabled: { opacity: 0.45 },
  down: { opacity: 0.7 },
  text: { fontSize: typography.metaSize, fontWeight: '500' }
})
