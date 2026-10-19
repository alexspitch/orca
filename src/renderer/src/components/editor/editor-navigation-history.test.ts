import { describe, expect, it } from 'vitest'
import {
  EMPTY_EDITOR_NAVIGATION_HISTORY,
  MAX_EDITOR_NAVIGATION_ENTRIES,
  canGoBackInEditorHistory,
  canGoForwardInEditorHistory,
  dropUnreachableEditorNavigationTarget,
  recordEditorJump,
  stepEditorNavigationHistory,
  type EditorNavigationLocation
} from './editor-navigation-history'

function at(filePath: string, line: number, column = 1): EditorNavigationLocation {
  return {
    worktreeId: 'wt',
    filePath,
    relativePath: filePath.slice(1),
    runtimeEnvironmentId: null,
    line,
    column
  }
}

describe('editor navigation history', () => {
  it('records the origin and the target of a jump', () => {
    const history = recordEditorJump(
      EMPTY_EDITOR_NAVIGATION_HISTORY,
      at('/a.ts', 3),
      at('/b.ts', 9)
    )
    expect(history.entries).toEqual([at('/a.ts', 3), at('/b.ts', 9)])
    expect(history.index).toBe(1)
    expect(canGoBackInEditorHistory(history)).toBe(true)
    expect(canGoForwardInEditorHistory(history)).toBe(false)
  })

  it('does not duplicate the current place when chaining jumps', () => {
    let history = recordEditorJump(EMPTY_EDITOR_NAVIGATION_HISTORY, at('/a.ts', 3), at('/b.ts', 9))
    history = recordEditorJump(history, at('/b.ts', 9, 5), at('/c.ts', 1))
    expect(history.entries.map((entry) => `${entry.filePath}:${entry.line}`)).toEqual([
      '/a.ts:3',
      '/b.ts:9',
      '/c.ts:1'
    ])
    expect(history.entries[1].column).toBe(5)
  })

  it('goes back and forward, returning to where the user moved within a file', () => {
    const history = recordEditorJump(
      EMPTY_EDITOR_NAVIGATION_HISTORY,
      at('/a.ts', 3),
      at('/b.ts', 9)
    )
    const back = stepEditorNavigationHistory(history, 'back', at('/b.ts', 20))
    expect(back?.target).toEqual(at('/a.ts', 3))
    const forward = stepEditorNavigationHistory(back!.history, 'forward', at('/a.ts', 4))
    expect(forward?.target).toEqual(at('/b.ts', 20))
    expect(forward?.history.entries[0]).toEqual(at('/a.ts', 4))
  })

  it('inserts the current place when the user switched files without a jump', () => {
    const history = recordEditorJump(
      EMPTY_EDITOR_NAVIGATION_HISTORY,
      at('/a.ts', 3),
      at('/b.ts', 9)
    )
    const back = stepEditorNavigationHistory(history, 'back', at('/other.ts', 2))
    expect(back?.target).toEqual(at('/b.ts', 9))
    const forward = stepEditorNavigationHistory(back!.history, 'forward', null)
    expect(forward?.target).toEqual(at('/other.ts', 2))
  })

  it('drops forward entries on a new jump', () => {
    let history = recordEditorJump(EMPTY_EDITOR_NAVIGATION_HISTORY, at('/a.ts', 1), at('/b.ts', 1))
    history = stepEditorNavigationHistory(history, 'back', null)!.history
    history = recordEditorJump(history, at('/a.ts', 1), at('/c.ts', 1))
    expect(history.entries.map((entry) => entry.filePath)).toEqual(['/a.ts', '/c.ts'])
    expect(canGoForwardInEditorHistory(history)).toBe(false)
  })

  it('stops at either end', () => {
    expect(stepEditorNavigationHistory(EMPTY_EDITOR_NAVIGATION_HISTORY, 'back', null)).toBeNull()
    const history = recordEditorJump(EMPTY_EDITOR_NAVIGATION_HISTORY, null, at('/a.ts', 1))
    expect(stepEditorNavigationHistory(history, 'back', at('/a.ts', 5))).toBeNull()
    expect(stepEditorNavigationHistory(history, 'forward', at('/a.ts', 5))).toBeNull()
  })

  it('caps the stack and keeps the index on the newest entry', () => {
    let history = EMPTY_EDITOR_NAVIGATION_HISTORY
    for (let line = 1; line <= MAX_EDITOR_NAVIGATION_ENTRIES + 10; line++) {
      history = recordEditorJump(history, null, at('/a.ts', line))
    }
    expect(history.entries).toHaveLength(MAX_EDITOR_NAVIGATION_ENTRIES)
    expect(history.index).toBe(MAX_EDITOR_NAVIGATION_ENTRIES - 1)
    expect(history.entries.at(-1)?.line).toBe(MAX_EDITOR_NAVIGATION_ENTRIES + 10)
  })

  it('skips an unreachable target and keeps walking the same way', () => {
    let history = recordEditorJump(
      EMPTY_EDITOR_NAVIGATION_HISTORY,
      at('/a.ts', 1),
      at('/gone.ts', 1)
    )
    history = recordEditorJump(history, at('/gone.ts', 1), at('/c.ts', 1))
    const back = stepEditorNavigationHistory(history, 'back', null)!
    expect(back.target.filePath).toBe('/gone.ts')
    const dropped = dropUnreachableEditorNavigationTarget(back.history, 'back')
    expect(dropped.entries.map((entry) => entry.filePath)).toEqual(['/a.ts', '/c.ts'])
    expect(stepEditorNavigationHistory(dropped, 'back', null)?.target.filePath).toBe('/a.ts')

    const forwardFrom = { entries: dropped.entries, index: 0 }
    const withGone = recordEditorJump(forwardFrom, null, at('/gone.ts', 1))
    const forwardHistory = { entries: [...withGone.entries, at('/d.ts', 1)], index: 0 }
    const forward = stepEditorNavigationHistory(forwardHistory, 'forward', null)!
    expect(forward.target.filePath).toBe('/gone.ts')
    const afterDrop = dropUnreachableEditorNavigationTarget(forward.history, 'forward')
    expect(stepEditorNavigationHistory(afterDrop, 'forward', null)?.target.filePath).toBe('/d.ts')
  })
})
