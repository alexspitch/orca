import { useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { ChevronDown } from 'lucide-react-native'
import { PickerModal, type PickerOption } from '../../components/PickerModal'
import { colors, radii, spacing, typography } from '../../theme/mobile-theme'

/** One labelled property of the card. */
export function PropertyRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.value}>{children}</View>
    </View>
  )
}

/** A value that reads as text and opens as a list — build-web's InlineSelect, as a sheet. */
export function PropertySelect<T extends string>({
  label,
  value,
  shown,
  options,
  disabled,
  onChange,
  onOpen
}: {
  label: string
  value: T
  /** What the closed control shows: a chip, or the option's label. */
  shown?: ReactNode
  options: PickerOption<T>[]
  disabled: boolean
  onChange: (value: T) => void
  /** Read the list again: what build-web adds while the card is open shows on the next open. */
  onOpen?: () => void
}) {
  const [open, setOpen] = useState(false)
  const current = options.find((o) => o.value === value)
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => {
          onOpen?.()
          setOpen(true)
        }}
        style={({ pressed }) => [
          styles.trigger,
          disabled ? styles.disabled : null,
          pressed ? styles.pressed : null
        ]}
      >
        <View style={styles.shown}>
          {shown ?? (
            <Text style={styles.text} numberOfLines={1}>
              {current?.label ?? '—'}
            </Text>
          )}
        </View>
        <ChevronDown size={14} color={colors.textMuted} />
      </Pressable>
      <PickerModal
        visible={open}
        title={label}
        options={options}
        selected={value}
        onSelect={(next) => {
          setOpen(false)
          if (next !== value) {
            onChange(next)
          }
        }}
        onClose={() => setOpen(false)}
      />
    </>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 36 },
  label: { width: 96, color: colors.textMuted, fontSize: typography.metaSize },
  value: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  trigger: {
    flex: 1,
    minWidth: 0,
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgBase
  },
  shown: { flex: 1, minWidth: 0 },
  text: { color: colors.textPrimary, fontSize: typography.bodySize },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.7 }
})
