import { create } from 'zustand'
import type { BuildWebIssueRow } from '../../../../shared/build-web-types'
import { readViewPrefs, writeViewPrefs } from './build-web-view-prefs'

// The list's families, as build-web groups them: a page is made of heads — a task, or a subtask
// whose task the filters left out — each followed by its subtasks on the page.

type Row = Pick<BuildWebIssueRow, 'id' | 'parent_id'>

/** Task id → how many of its subtasks the page holds. */
export function familiesOf(issues: readonly Row[]): Map<string, number> {
  const onPage = new Set(issues.map((i) => i.id))
  const kids = new Map<string, number>()
  for (const i of issues) {
    if (i.parent_id && onPage.has(i.parent_id)) {
      kids.set(i.parent_id, (kids.get(i.parent_id) ?? 0) + 1)
    }
  }
  return kids
}

/** A subtask shown under its task on this page; one whose task is not here is a head. */
export const isUnder = (issue: Row, kids: ReadonlyMap<string, number>): boolean =>
  Boolean(issue.parent_id && kids.has(issue.parent_id))

/** The rows a page counts — what the pager's range is made of. */
export const headCount = (issues: readonly Row[], kids: ReadonlyMap<string, number>): number =>
  issues.filter((i) => !isUnder(i, kids)).length

/** The folded tasks: every family when all are folded, less the ones opened by hand. */
export function foldedOf(
  foldAll: boolean,
  toggled: readonly string[],
  kids: ReadonlyMap<string, number>
): Set<string> {
  return new Set(foldAll ? [...kids.keys()].filter((id) => !toggled.includes(id)) : toggled)
}

/** The page without the subtasks of folded tasks. */
export function visibleIssues<T extends Row>(
  issues: readonly T[],
  kids: ReadonlyMap<string, number>,
  folded: ReadonlySet<string>
): T[] {
  return issues.filter((i) => !(isUnder(i, kids) && i.parent_id && folded.has(i.parent_id)))
}

type Folds = {
  foldAll: boolean
  /** Toggled by hand against `foldAll`. */
  toggled: string[]
  toggle: (id: string) => void
  setFoldAll: (on: boolean) => void
}

const prefs = readViewPrefs()

/** Which families are folded — kept per viewer, like the rest of the list's view. */
export const useIssueFolds = create<Folds>()((set) => ({
  foldAll: prefs.foldAll,
  toggled: prefs.folded,
  toggle: (id) =>
    set((state) => {
      const toggled = state.toggled.includes(id)
        ? state.toggled.filter((x) => x !== id)
        : [...state.toggled, id]
      writeViewPrefs({ folded: toggled })
      return { toggled }
    }),
  setFoldAll: (foldAll) => {
    writeViewPrefs({ foldAll, folded: [] })
    set({ foldAll, toggled: [] })
  }
}))
