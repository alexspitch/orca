import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { Check, Minus, type LucideIcon } from 'lucide-react-native'
import { LoadingSpinner } from '../../../../components/LoadingSpinner'
import { colors, radii, spacing, typography } from '../../../../theme/mobile-theme'

// The Build tab's small controls: its buttons, cards, error line and tick boxes.

type ButtonVariant = 'primary' | 'outline' | 'ghost'

export function BuildTabButton({
  label,
  icon: Icon,
  variant = 'outline',
  disabled,
  loading,
  trailing,
  onPress,
  accessibilityLabel,
  style
}: {
  label?: string
  icon?: LucideIcon
  variant?: ButtonVariant
  disabled?: boolean
  loading?: boolean
  trailing?: LucideIcon
  onPress: () => void
  accessibilityLabel?: string
  style?: StyleProp<ViewStyle>
}) {
  const color = variant === 'primary' ? colors.bgBase : colors.textPrimary
  const Trailing = trailing
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: Boolean(disabled || loading) }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && styles.primary,
        variant === 'outline' && styles.outline,
        !label && styles.iconOnly,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
        style
      ]}
    >
      {loading ? (
        <LoadingSpinner size={14} color={color} />
      ) : Icon ? (
        <Icon size={14} color={color} />
      ) : null}
      {label ? (
        <Text numberOfLines={1} style={[styles.buttonText, { color }]}>
          {label}
        </Text>
      ) : null}
      {Trailing ? <Trailing size={12} color={color} /> : null}
    </Pressable>
  )
}

export function BuildTabSection({ children }: { children: ReactNode }) {
  return <View style={styles.section}>{children}</View>
}

export function BuildTabError({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  return (
    <View style={styles.error} accessibilityRole="alert">
      <Text style={styles.errorText}>{message}</Text>
      {onDismiss ? (
        <Pressable accessibilityRole="button" onPress={onDismiss} hitSlop={8}>
          <Text style={styles.errorDismiss}>Dismiss</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

export type TickState = boolean | 'mixed'

/** A tick box; `mixed` for a select-all over some of its rows. */
export function BuildTabTick({
  checked,
  disabled,
  onPress,
  accessibilityLabel
}: {
  checked: TickState
  disabled?: boolean
  onPress: () => void
  accessibilityLabel: string
}) {
  const on = checked !== false
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked, disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={10}
      style={[styles.tick, on && styles.tickOn, disabled && styles.disabled]}
    >
      {checked === 'mixed' ? (
        <Minus size={12} color={colors.bgBase} strokeWidth={3} />
      ) : checked ? (
        <Check size={12} color={colors.bgBase} strokeWidth={3} />
      ) : null}
    </Pressable>
  )
}

export const buildTabText = StyleSheet.create({
  muted: { color: colors.textMuted, fontSize: typography.metaSize },
  small: { color: colors.textMuted, fontSize: 11 },
  body: { color: colors.textPrimary, fontSize: typography.bodySize },
  mono: {
    color: colors.textPrimary,
    fontSize: typography.metaSize,
    fontFamily: typography.monoFamily
  },
  heading: { color: colors.textPrimary, fontSize: typography.bodySize, fontWeight: '600' },
  danger: { color: colors.statusRed, fontSize: typography.metaSize }
})

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs + 2,
    minHeight: 34,
    paddingHorizontal: spacing.md,
    borderRadius: radii.button
  },
  iconOnly: { paddingHorizontal: spacing.sm, minWidth: 34 },
  primary: { backgroundColor: colors.textPrimary },
  outline: {
    backgroundColor: colors.bgPanel,
    borderWidth: 1,
    borderColor: colors.borderSubtle
  },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.7 },
  buttonText: { fontSize: typography.metaSize + 1, fontWeight: '600', flexShrink: 1 },
  section: {
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgPanel
  },
  error: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.sm + 2,
    borderRadius: radii.row,
    borderWidth: 1,
    borderColor: `${colors.statusRed}66`,
    backgroundColor: `${colors.statusRed}1a`
  },
  errorText: { flex: 1, color: colors.statusRed, fontSize: typography.metaSize },
  errorDismiss: { color: colors.statusRed, fontSize: typography.metaSize, fontWeight: '600' },
  tick: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center'
  },
  tickOn: { backgroundColor: colors.textPrimary, borderColor: colors.textPrimary }
})
