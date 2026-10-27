import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { LucideIcon } from 'lucide-react-native'
import { colors, radii, spacing, typography } from '../../../../theme/mobile-theme'
import { LoadingSpinner } from '../../../../components/LoadingSpinner'

type Variant = 'primary' | 'outline' | 'ghost'

/** The tab's buttons, after the desktop's default, outline and ghost buttons. */
export function GuideButton({
  label,
  onPress,
  variant = 'outline',
  disabled = false,
  busy = false,
  icon: Icon,
  compact = false
}: {
  label: string
  onPress: () => void
  variant?: Variant
  disabled?: boolean
  busy?: boolean
  icon?: LucideIcon
  compact?: boolean
}) {
  const tint = variant === 'primary' ? colors.bgBase : colors.textPrimary
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.compact,
        styles[variant],
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed
      ]}
    >
      {busy ? (
        <LoadingSpinner size={14} color={tint} />
      ) : Icon ? (
        <View>
          <Icon size={14} color={tint} />
        </View>
      ) : null}
      <Text style={[styles.label, { color: tint }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs + 2,
    borderRadius: radii.button,
    paddingHorizontal: spacing.md
  },
  compact: { minHeight: 30, paddingHorizontal: spacing.sm },
  primary: { backgroundColor: colors.surfaceBright },
  outline: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderSubtle },
  ghost: {},
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.75 },
  label: { fontSize: typography.bodySize - 1, fontWeight: '600' }
})
