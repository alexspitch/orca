import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'

export type PropertyOption = { value: string; label: React.ReactNode }

/** A value that reads as text and opens as a list — build-web's InlineSelect. */
export function InlineSelect({
  label,
  value,
  options,
  disabled,
  onChange,
  onOpen,
  invalid
}: {
  label: string
  value: string
  options: PropertyOption[]
  disabled: boolean
  onChange: (value: string) => void
  /** Read the list again: what build-web adds while the card is open shows on the next open. */
  onOpen?: () => void
  /** A required value is missing: the control is drawn in the error colour. */
  invalid?: boolean
}): React.JSX.Element {
  return (
    <Select
      value={value}
      disabled={disabled}
      onValueChange={onChange}
      onOpenChange={(open) => open && onOpen?.()}
    >
      <SelectTrigger
        size="sm"
        aria-label={label}
        aria-invalid={invalid || undefined}
        className="w-full min-w-0"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function PropertyRow({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <>
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex min-w-0 items-center gap-1">{children}</div>
    </>
  )
}
