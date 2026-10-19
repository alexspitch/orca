import React from 'react'
import { ArrowLeft, ArrowRight, ListTree } from 'lucide-react'
import type { KeybindingActionId } from '../../../../shared/keybindings'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ShortcutKeyCombo } from '@/components/ShortcutKeyCombo'
import { useShortcutKeyDetails } from '@/hooks/useShortcutLabel'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { useMountedCodeEditor } from './mounted-code-editor-registry'
import { useEditorNavigationAvailability } from './editor-navigation-history-store'
import { navigateEditorHistory } from './editor-location-navigation'

// Same chrome as the header's other icon toggles (Table of Contents, diff navigation).
const HEADER_ICON_BUTTON_CLASS_NAME =
  'p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground aria-pressed:bg-accent aria-pressed:text-foreground transition-colors flex-shrink-0 disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-muted-foreground'

function HeaderIconButton({
  label,
  shortcutActionId,
  disabled,
  pressed,
  onClick,
  children
}: {
  label: string
  shortcutActionId: KeybindingActionId
  disabled?: boolean
  pressed?: boolean
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  const shortcut = useShortcutKeyDetails(shortcutActionId)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={HEADER_ICON_BUTTON_CLASS_NAME}
          aria-label={label}
          aria-pressed={pressed}
          disabled={disabled}
          onClick={onClick}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={4}>
        {label}
        {shortcut.keys.length > 0 && (
          <ShortcutKeyCombo
            keys={shortcut.keys}
            doubleTap={shortcut.doubleTap}
            className="ml-1.5"
          />
        )}
      </TooltipContent>
    </Tooltip>
  )
}

/** Back/Forward through editor locations, and the code outline toggle where the file has one. */
export function EditorCodeNavigationHeaderControls({
  viewStateId,
  worktreeId,
  canShowOutline
}: {
  viewStateId: string
  worktreeId: string
  canShowOutline: boolean
}): React.JSX.Element {
  const mountedEditor = useMountedCodeEditor(viewStateId)
  const { canGoBack, canGoForward } = useEditorNavigationAvailability(worktreeId)
  const outlineVisible = useAppStore((s) => s.codeOutlineVisible)
  const setCodeOutlineVisible = useAppStore((s) => s.setCodeOutlineVisible)

  return (
    <TooltipProvider delayDuration={300}>
      <HeaderIconButton
        label={translate(
          'auto.components.editor.EditorCodeNavigationHeaderControls.fb39186be3',
          'Previous location'
        )}
        shortcutActionId="editor.navigateBack"
        disabled={!canGoBack}
        onClick={() => void navigateEditorHistory('back', mountedEditor)}
      >
        <ArrowLeft size={14} />
      </HeaderIconButton>
      <HeaderIconButton
        label={translate(
          'auto.components.editor.EditorCodeNavigationHeaderControls.5520d5a1a7',
          'Next location'
        )}
        shortcutActionId="editor.navigateForward"
        disabled={!canGoForward}
        onClick={() => void navigateEditorHistory('forward', mountedEditor)}
      >
        <ArrowRight size={14} />
      </HeaderIconButton>
      {canShowOutline ? (
        <HeaderIconButton
          label={translate(
            'auto.components.editor.EditorCodeNavigationHeaderControls.36e2361ea7',
            'Outline'
          )}
          shortcutActionId="editor.toggleOutline"
          pressed={outlineVisible}
          onClick={() => setCodeOutlineVisible(!outlineVisible)}
        >
          <ListTree size={14} />
        </HeaderIconButton>
      ) : null}
    </TooltipProvider>
  )
}
