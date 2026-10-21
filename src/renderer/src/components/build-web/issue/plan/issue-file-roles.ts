import type { BuildWebIssueFile } from '../../../../../../shared/build-web-types'

// Which files of a task the card's Plan and Mockups tabs show, and what a plan says of its own
// progress — as build-web's fileRoles.ts.

const newestFirst = (a: BuildWebIssueFile, b: BuildWebIssueFile) =>
  b.created_at.localeCompare(a.created_at)

/** The task's own files with this role, the newest first — the one a tab opens on. */
export const filesWithRole = (
  files: readonly BuildWebIssueFile[],
  role: 'plan' | 'mockup'
): BuildWebIssueFile[] =>
  files.filter((f) => f.comment_id === null && f.role === role).sort(newestFirst)

/**
 * The steps of a plan: its task-list items, ticked and all. A fenced block is skipped — a plan
 * quoting a checklist in an example is not those steps.
 */
export function planProgress(text: string): { done: number; total: number } {
  let done = 0
  let total = 0
  let fenced = false
  for (const line of text.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced
      continue
    }
    if (fenced) {
      continue
    }
    const item = /^\s*(?:[-*+]|\d+[.)])\s+\[([ xX])\]\s/.exec(line)
    if (!item) {
      continue
    }
    total++
    if (item[1] !== ' ') {
      done++
    }
  }
  return { done, total }
}
