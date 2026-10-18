export type GitLogMenuEntry =
  | { label: string; onSelect?: () => void; shortcut?: string; destructive?: boolean }
  | 'separator'

/** Stable React keys for a menu: items by label, separators by the item above them. */
export function keyGitLogMenuEntries(
  entries: readonly GitLogMenuEntry[]
): { key: string; entry: GitLogMenuEntry }[] {
  let previous = 'start'
  return entries.map((entry) => {
    if (entry === 'separator') {
      return { key: `separator-after-${previous}`, entry }
    }
    previous = entry.label
    return { key: entry.label, entry }
  })
}
