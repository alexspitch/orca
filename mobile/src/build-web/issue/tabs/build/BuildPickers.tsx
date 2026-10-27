import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { ChevronDown } from 'lucide-react-native'
import { BottomDrawer } from '../../../../components/BottomDrawer'
import { MobileSearchField } from '../../../../components/MobileSearchField'
import { PickerModal } from '../../../../components/PickerModal'
import { colors, radii, spacing, typography } from '../../../../theme/mobile-theme'

// Why a cap: the registry holds a few hundred images; the search narrows them, the list stays short.
const SHOWN = 80

function FieldTrigger({
  text,
  placeholder,
  mono,
  disabled,
  onPress,
  accessibilityLabel
}: {
  text: string | null
  placeholder?: string
  mono?: boolean
  disabled?: boolean
  onPress: () => void
  accessibilityLabel: string
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.field,
        disabled && styles.disabled,
        pressed && styles.pressed
      ]}
    >
      <Text
        numberOfLines={1}
        style={[styles.fieldText, mono && text ? styles.mono : null, !text && styles.placeholder]}
      >
        {text ?? placeholder}
      </Text>
      <ChevronDown size={14} color={colors.textMuted} />
    </Pressable>
  )
}

/** One image out of the registry's list, found by typing a part of its name. */
export function ImagePicker({
  images,
  value,
  onChange,
  disabled
}: {
  images: string[]
  value: string | null
  onChange: (image: string | null) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const found = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (q ? images.filter((i) => i.toLowerCase().includes(q)) : images).slice(0, SHOWN)
  }, [images, query])
  const close = () => {
    setOpen(false)
    setQuery('')
  }
  return (
    <>
      <FieldTrigger
        text={value}
        placeholder="Pick an image…"
        mono
        disabled={disabled}
        onPress={() => setOpen(true)}
        accessibilityLabel="Pick an image"
      />
      <BottomDrawer visible={open} onClose={close} fillAvailable contentScrollable={false}>
        <View style={styles.sheet}>
          <MobileSearchField
            value={query}
            onChangeText={setQuery}
            placeholder="Search images"
            autoFocus
          />
          <View style={styles.list}>
            {found.length === 0 ? <Text style={styles.empty}>No such image.</Text> : null}
            <ImageRows
              images={found}
              selected={value}
              onPick={(image) => {
                onChange(image)
                close()
              }}
            />
          </View>
        </View>
      </BottomDrawer>
    </>
  )
}

function ImageRows({
  images,
  selected,
  onPick
}: {
  images: string[]
  selected: string | null
  onPick: (image: string) => void
}) {
  return (
    <ScrollView keyboardShouldPersistTaps="handled" style={styles.scroll}>
      {images.map((image) => (
        <Pressable
          key={image}
          accessibilityRole="button"
          onPress={() => onPick(image)}
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        >
          <Text style={[styles.mono, image === selected && styles.selected]}>{image}</Text>
        </Pressable>
      ))}
    </ScrollView>
  )
}

const asLabel = (option: string): string => option

/** A value out of a short list — a branch, a distribution — picked in a sheet. */
export function SelectField<T extends string>({
  title,
  value,
  options,
  onChange,
  disabled,
  mono,
  labelOf = asLabel,
  placeholder
}: {
  title: string
  value: T
  options: readonly T[]
  onChange: (value: T) => void
  disabled?: boolean
  mono?: boolean
  labelOf?: (option: T) => string
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <FieldTrigger
        text={value ? labelOf(value) : null}
        placeholder={placeholder}
        mono={mono}
        disabled={disabled}
        onPress={() => setOpen(true)}
        accessibilityLabel={title}
      />
      <PickerModal
        visible={open}
        title={title}
        options={options.map((o) => ({ value: o, label: labelOf(o) }))}
        selected={value}
        onSelect={onChange}
        onClose={() => setOpen(false)}
      />
    </>
  )
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgBase
  },
  fieldText: { flex: 1, color: colors.textPrimary, fontSize: typography.metaSize + 1 },
  placeholder: { color: colors.textMuted },
  mono: {
    color: colors.textPrimary,
    fontFamily: typography.monoFamily,
    fontSize: typography.metaSize
  },
  selected: { fontWeight: '700' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.7 },
  sheet: { flex: 1, gap: spacing.sm },
  list: { flex: 1, minHeight: 0 },
  scroll: { flex: 1 },
  empty: { color: colors.textMuted, fontSize: typography.metaSize, padding: spacing.md },
  row: { paddingVertical: spacing.md, paddingHorizontal: spacing.sm, borderRadius: radii.row },
  rowPressed: { backgroundColor: colors.bgRaised }
})
