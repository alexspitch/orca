import { describe, expect, it } from 'vitest'
import {
  findKeybindingConflicts,
  getEffectiveKeybindingsForAction,
  keybindingMatchesAction
} from './keybindings'

const chord = (
  key: string,
  code: string,
  mods: { control?: boolean; alt?: boolean; shift?: boolean }
) => ({
  key,
  code,
  meta: false,
  control: mods.control ?? false,
  alt: mods.alt ?? false,
  shift: mods.shift ?? false
})

describe('editor navigation keybindings', () => {
  it('uses VS Code chords per platform', () => {
    expect(getEffectiveKeybindingsForAction('editor.navigateBack', 'darwin')).toEqual([
      'Ctrl+Minus'
    ])
    expect(getEffectiveKeybindingsForAction('editor.navigateForward', 'darwin')).toEqual([
      'Ctrl+Shift+Underscore'
    ])
    for (const platform of ['linux', 'win32'] as const) {
      expect(getEffectiveKeybindingsForAction('editor.navigateBack', platform)).toEqual([
        'Alt+ArrowLeft'
      ])
      expect(getEffectiveKeybindingsForAction('editor.navigateForward', platform)).toEqual([
        'Alt+ArrowRight'
      ])
      expect(getEffectiveKeybindingsForAction('editor.toggleOutline', platform)).toEqual([])
    }
  })

  it('matches macOS Ctrl+Minus and the shifted underscore for Forward', () => {
    expect(
      keybindingMatchesAction(
        'editor.navigateBack',
        chord('-', 'Minus', { control: true }),
        'darwin'
      )
    ).toBe(true)
    const shifted = chord('_', 'Minus', { control: true, shift: true })
    expect(keybindingMatchesAction('editor.navigateForward', shifted, 'darwin')).toBe(true)
    expect(keybindingMatchesAction('editor.navigateBack', shifted, 'darwin')).toBe(false)
    // Cmd+Minus stays zoom out.
    expect(
      keybindingMatchesAction(
        'editor.navigateBack',
        { ...chord('-', 'Minus', {}), meta: true },
        'darwin'
      )
    ).toBe(false)
  })

  it('matches Alt+Arrow on Linux and Windows', () => {
    for (const platform of ['linux', 'win32'] as const) {
      expect(
        keybindingMatchesAction(
          'editor.navigateBack',
          chord('ArrowLeft', 'ArrowLeft', { alt: true }),
          platform
        )
      ).toBe(true)
      expect(
        keybindingMatchesAction(
          'editor.navigateForward',
          chord('ArrowRight', 'ArrowRight', { alt: true }),
          platform
        )
      ).toBe(true)
    }
  })

  it('adds no default conflicts', () => {
    for (const platform of ['darwin', 'linux', 'win32'] as const) {
      expect(
        findKeybindingConflicts(platform).filter((conflict) =>
          conflict.actionIds.some((id) => id.startsWith('editor.navigate'))
        )
      ).toEqual([])
    }
  })
})
