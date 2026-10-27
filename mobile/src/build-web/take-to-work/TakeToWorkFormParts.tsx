import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Check } from 'lucide-react-native'
import { colors, radii, spacing, typography } from '../../theme/mobile-theme'

/** A labelled block of the sheet. */
export function TakeToWorkField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={partStyles.field}>
      <Text style={partStyles.label}>{label}</Text>
      {children}
    </View>
  )
}

/** One pickable entry of a short list: the desktop's select items, laid out for touch. */
export function TakeToWorkChoice({
  title,
  detail,
  selected,
  onPress
}: {
  title: string
  detail?: string
  selected: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      aria-checked={selected}
      style={({ pressed }) => [
        partStyles.choice,
        selected && partStyles.choiceSelected,
        pressed && partStyles.pressed
      ]}
    >
      <View style={partStyles.choiceText}>
        <Text style={partStyles.choiceTitle} numberOfLines={1}>
          {title}
        </Text>
        {detail ? (
          <Text style={partStyles.hint} numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
      </View>
      {selected ? <Check size={16} color={colors.textPrimary} /> : null}
    </Pressable>
  )
}

export function TakeToWorkInput(props: {
  value: string
  onChangeText: (value: string) => void
  placeholder?: string
  multiline?: boolean
  maxLength?: number
  accessibilityLabel: string
}) {
  return (
    <TextInput
      {...props}
      autoCapitalize="none"
      autoCorrect={false}
      placeholderTextColor={colors.textMuted}
      style={[partStyles.input, props.multiline && partStyles.multiline]}
    />
  )
}

export const partStyles = StyleSheet.create({
  field: { gap: spacing.xs + 2 },
  label: { color: colors.textPrimary, fontSize: typography.bodySize, fontWeight: '600' },
  hint: { color: colors.textMuted, fontSize: typography.metaSize, lineHeight: 17 },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.row,
    borderWidth: 1,
    borderColor: colors.borderSubtle
  },
  choiceSelected: { backgroundColor: colors.bgRaised },
  choiceText: { flex: 1, minWidth: 0 },
  choiceTitle: { color: colors.textPrimary, fontSize: typography.bodySize },
  pressed: { opacity: 0.7 },
  input: {
    color: colors.textPrimary,
    fontSize: typography.bodySize,
    backgroundColor: colors.bgPanel,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radii.input,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  multiline: { minHeight: 72, textAlignVertical: 'top' }
})
