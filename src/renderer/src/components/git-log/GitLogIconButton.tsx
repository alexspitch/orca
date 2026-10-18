import React from 'react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Toggle } from '@/components/ui/toggle'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ShortcutKeyCombo } from '@/components/ShortcutKeyCombo'

type GitLogIconButtonProps = {
  label: string
  icon: LucideIcon
  onClick?: () => void
  /** Inert (nothing to act on), still showing its tooltip. */
  disabled?: boolean
  /** The bound keys, shown after the label. */
  shortcut?: { keys: string[]; doubleTap: boolean }
  /** Renders a pressed/unpressed toggle instead of a plain button. */
  pressed?: boolean
  side?: 'top' | 'right' | 'bottom' | 'left'
}

/** A 24 px toolbar icon with a tooltip, as in WebStorm's tool-window toolbars. */
export function GitLogIconButton({
  label,
  icon: Icon,
  onClick,
  disabled = false,
  shortcut,
  pressed,
  side = 'top'
}: GitLogIconButtonProps): React.JSX.Element {
  const glyph = <Icon className="size-3.5 text-muted-foreground" strokeWidth={1.75} />
  const control = disabled ? (
    // Why the span: a disabled button takes no pointer events, so it could never show its tooltip.
    <span tabIndex={0} aria-label={label} className="inline-flex shrink-0 rounded-md">
      <Button type="button" variant="ghost" size="icon-xs" disabled tabIndex={-1}>
        {glyph}
      </Button>
    </span>
  ) : pressed === undefined ? (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      aria-label={label}
      onClick={onClick}
      className="shrink-0"
    >
      {glyph}
    </Button>
  ) : (
    <Toggle
      size="xs"
      aria-label={label}
      pressed={pressed}
      onPressedChange={() => onClick?.()}
      className="shrink-0"
    >
      {glyph}
    </Toggle>
  )
  return (
    <Tooltip>
      <TooltipTrigger asChild>{control}</TooltipTrigger>
      <TooltipContent side={side} sideOffset={4}>
        {label}
        {shortcut && shortcut.keys.length > 0 ? (
          <ShortcutKeyCombo
            keys={shortcut.keys}
            doubleTap={shortcut.doubleTap}
            className="ml-1.5"
          />
        ) : null}
      </TooltipContent>
    </Tooltip>
  )
}
