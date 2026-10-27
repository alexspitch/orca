import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { LucideIcon } from 'lucide-react-native'
import { colors, radii, spacing, typography } from '../../theme/mobile-theme'

// The card's own small controls: the desktop's outline/primary buttons, its panels and their titles.

type ButtonVariant = 'outline' | 'primary' | 'ghost'

export function CardButton({
  label,
  onPress,
  disabled,
  variant = 'outline',
  icon: Icon,
  accessibilityLabel
}: {
  label?: string
  onPress: () => void
  disabled?: boolean
  variant?: ButtonVariant
  icon?: LucideIcon
  accessibilityLabel?: string
}) {
  const textColor = variant === 'primary' ? colors.bgBase : colors.textPrimary
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        ui.button,
        variant === 'primary' ? ui.primary : null,
        variant === 'outline' ? ui.outline : null,
        !label ? ui.iconOnly : null,
        disabled ? ui.disabled : null,
        pressed && !disabled ? ui.pressed : null
      ]}
    >
      {Icon ? <Icon size={14} color={textColor} /> : null}
      {label ? (
        <Text style={[ui.buttonText, { color: textColor }]} numberOfLines={1}>
          {label}
        </Text>
      ) : null}
    </Pressable>
  )
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={ui.sectionTitle}>{children}</Text>
}

/** A titled card of the overview, as build-web's side cards. */
export function OverviewPanel({
  title,
  action,
  children
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <View style={ui.panel}>
      <View style={ui.panelHead}>
        <SectionTitle>{title}</SectionTitle>
        <View style={ui.grow} />
        {action}
      </View>
      {children}
    </View>
  )
}

export function MutedText({ children }: { children: ReactNode }) {
  return <Text style={ui.muted}>{children}</Text>
}

export function ErrorText({ children }: { children: ReactNode }) {
  return (
    <Text style={ui.error} accessibilityRole="alert">
      {children}
    </Text>
  )
}

/** Cancel and Save under an edited text, as the desktop's in-place editors. */
export function SaveCancelRow({
  disabled,
  onSave,
  onCancel,
  saveLabel = 'Save'
}: {
  disabled: boolean
  onSave: () => void
  onCancel: () => void
  saveLabel?: string
}) {
  return (
    <View style={ui.saveRow}>
      <CardButton variant="ghost" label="Cancel" onPress={onCancel} />
      <CardButton variant="primary" label={saveLabel} disabled={disabled} onPress={onSave} />
    </View>
  )
}

export const ui = StyleSheet.create({
  grow: { flex: 1 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 32,
    paddingHorizontal: spacing.md,
    borderRadius: radii.button
  },
  iconOnly: { paddingHorizontal: spacing.sm },
  outline: { borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: colors.bgPanel },
  primary: { backgroundColor: colors.textPrimary },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.7 },
  buttonText: { fontSize: 13, fontWeight: '600' },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase'
  },
  panel: {
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgPanel
  },
  panelHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 24 },
  muted: { color: colors.textMuted, fontSize: typography.metaSize, lineHeight: 17 },
  body: { color: colors.textPrimary, fontSize: typography.bodySize, lineHeight: 20 },
  error: { color: colors.statusRed, fontSize: typography.metaSize, lineHeight: 17 },
  link: { color: colors.accentBlue, fontSize: typography.bodySize, fontWeight: '600' },
  mono: { fontFamily: typography.monoFamily },
  input: {
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgBase,
    borderRadius: radii.input,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    fontSize: typography.bodySize
  },
  multiline: { minHeight: 88, textAlignVertical: 'top' },
  saveRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm }
})
