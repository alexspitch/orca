import { parsePatch } from 'diff'

// A commit's patch as «before / after» rows, after build-web's diffView.ts but on the `diff`
// package Orca already ships. Text only: nothing here is ever rendered as HTML.

export type DiffCell = {
  line: number | null
  text: string
  kind: 'same' | 'removed' | 'added' | 'empty'
}
export type DiffRow = { left: DiffCell; right: DiffCell }
export type DiffFile = {
  path: string
  status: 'added' | 'deleted' | 'changed'
  added: number
  removed: number
  rows: DiffRow[]
}

const EMPTY: DiffCell = { line: null, text: '', kind: 'empty' }
const strip = (name: string | undefined) => (name ?? '').replace(/^[ab]\//, '')

/** One file's hunks as side-by-side rows: removals and additions of a run are paired line by line. */
function rowsOf(hunks: ReturnType<typeof parsePatch>[number]['hunks']): DiffRow[] {
  const rows: DiffRow[] = []
  for (const hunk of hunks) {
    let left = hunk.oldStart
    let right = hunk.newStart
    let removed: DiffCell[] = []
    let added: DiffCell[] = []
    const flush = () => {
      for (let n = 0; n < Math.max(removed.length, added.length); n++) {
        rows.push({ left: removed[n] ?? EMPTY, right: added[n] ?? EMPTY })
      }
      removed = []
      added = []
    }
    for (const raw of hunk.lines) {
      const mark = raw[0]
      const text = raw.slice(1)
      if (mark === '-') {
        removed.push({ line: left++, text, kind: 'removed' })
      } else if (mark === '+') {
        added.push({ line: right++, text, kind: 'added' })
      } else if (mark === ' ') {
        flush()
        rows.push({
          left: { line: left++, text, kind: 'same' },
          right: { line: right++, text, kind: 'same' }
        })
      }
    }
    flush()
  }
  return rows
}

export function diffFilesOf(patch: string): DiffFile[] {
  return parsePatch(patch).map((file) => {
    const before = strip(file.oldFileName)
    const after = strip(file.newFileName)
    const status =
      before === '/dev/null' || before === 'dev/null'
        ? 'added'
        : after === '/dev/null' || after === 'dev/null'
          ? 'deleted'
          : 'changed'
    const rows = rowsOf(file.hunks)
    return {
      path: status === 'deleted' ? before : after,
      status,
      added: rows.filter((r) => r.right.kind === 'added').length,
      removed: rows.filter((r) => r.left.kind === 'removed').length,
      rows
    }
  })
}
