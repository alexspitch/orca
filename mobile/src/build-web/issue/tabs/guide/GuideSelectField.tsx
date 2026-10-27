import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { ChevronDown } from 'lucide-react-native'
import { colors } from '../../../../theme/mobile-theme'
import { PickerModal, type PickerOption } from '../../../../components/PickerModal'
import { guideStyles } from './guide-tab-styles'

/** A labelled value that opens as a list — the desktop's Select, as a sheet. */
export function GuideSelectField({
  label,
  value,
  options,
  disabled = false,
  invalid = false,
  hint,
  hintDanger = false,
  onChange,
  onOpen
}: {
  label: string
  value: string
  options: PickerOption[]
  disabled?: boolean
  invalid?: boolean
  hint?: string
  hintDanger?: boolean
  onChange: (value: string) => void
  /** Read the list again before it shows. */
  onOpen?: () => void
}) {
  const [open, setOpen] = useState(false)
  const shown = options.find((o) => o.value === value)
  return (
    <View style={guideStyles.field}>
      <Text style={guideStyles.meta}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled}
        onPress={() => {
          onOpen?.()
          setOpen(true)
        }}
        style={[
          guideStyles.select,
          invalid && guideStyles.selectInvalid,
          disabled && { opacity: 0.5 }
        ]}
      >
        <Text style={guideStyles.selectText} numberOfLines={1}>
          {shown?.label ?? value}
          {shown?.subtitle ? ` · ${shown.subtitle}` : ''}
        </Text>
        <ChevronDown size={16} color={colors.textMuted} />
      </Pressable>
      {hint ? (
        <Text style={hintDanger ? guideStyles.danger : guideStyles.small}>{hint}</Text>
      ) : null}
      <PickerModal
        visible={open}
        title={label}
        options={options}
        selected={value}
        onSelect={(next) => {
          if (next !== value) {
            onChange(next)
          }
        }}
        onClose={() => setOpen(false)}
      />
    </View>
  )
}
