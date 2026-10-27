import type { MobileDiffLine } from '../../../../session/mobile-diff-lines'

// A commit's patch as one file's lines after another, read the way a phone shows a diff: the
// removed lines over the added ones. Text only: nothing here is ever rendered as HTML.

export type CommitPatchLine = MobileDiffLine | { kind: 'hunk'; text: string }
export type CommitPatchFile = {
  path: string
  status: 'added' | 'deleted' | 'changed'
  added: number
  removed: number
  lines: CommitPatchLine[]
}

const HUNK = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/
const stripSide = (name: string) => name.replace(/^[ab]\//, '').replace(/\t.*$/, '')

/** A file git could not give as one patch (a merge's combined diff): its lines as plain text. */
function rawFileOf(chunk: string): CommitPatchFile {
  const path = /^diff --cc (\S+)/.exec(chunk)?.[1] ?? '?'
  const lines = chunk
    .split('\n')
    .map((text, n): CommitPatchLine => ({ kind: 'context', text, oldLineNumber: n + 1 }))
  return { path, status: 'changed', added: 0, removed: 0, lines }
}

function fileOf(chunk: string): CommitPatchFile {
  const header = /^diff --git a\/(\S+) b\/(\S+)/.exec(chunk)
  let before = header?.[1] ?? ''
  let after = header?.[2] ?? ''
  let status: CommitPatchFile['status'] = 'changed'
  const lines: CommitPatchLine[] = []
  let added = 0
  let removed = 0
  let left = 0
  let right = 0
  let inHunk = false
  for (const raw of chunk.split('\n')) {
    const hunk = HUNK.exec(raw)
    if (hunk) {
      inHunk = true
      left = Number(hunk[1])
      right = Number(hunk[2])
      lines.push({ kind: 'hunk', text: raw })
      continue
    }
    if (!inHunk) {
      if (raw.startsWith('--- ')) {
        const name = raw.slice(4)
        status = name === '/dev/null' ? 'added' : status
        before = name === '/dev/null' ? before : stripSide(name)
      } else if (raw.startsWith('+++ ')) {
        const name = raw.slice(4)
        status = name === '/dev/null' ? 'deleted' : status
        after = name === '/dev/null' ? after : stripSide(name)
      } else if (raw.startsWith('new file mode')) {
        status = 'added'
      } else if (raw.startsWith('deleted file mode')) {
        status = 'deleted'
      } else if (raw.startsWith('Binary files') || raw.startsWith('rename ')) {
        lines.push({ kind: 'hunk', text: raw })
      }
      continue
    }
    const mark = raw[0]
    const text = raw.slice(1)
    if (mark === '-') {
      removed++
      lines.push({ kind: 'delete', text, oldLineNumber: left++ })
    } else if (mark === '+') {
      added++
      lines.push({ kind: 'add', text, newLineNumber: right++ })
    } else if (mark === ' ') {
      lines.push({ kind: 'context', text, oldLineNumber: left++, newLineNumber: right++ })
    }
  }
  return { path: status === 'deleted' ? before : after || before, status, added, removed, lines }
}

export function commitPatchFiles(patch: string): CommitPatchFile[] {
  const gitFiles = patch
    .split(/^(?=diff --(?:git|cc) )/m)
    .filter((chunk) => chunk.startsWith('diff --'))
  if (gitFiles.length > 0) {
    return gitFiles.map((chunk) =>
      chunk.startsWith('diff --cc ') ? rawFileOf(chunk) : fileOf(chunk)
    )
  }
  // Why: a plain unified patch has no `diff --git` lines; its files start at `---`/`+++`.
  return patch
    .split(/^(?=--- .*\n\+\+\+ )/m)
    .filter((chunk) => chunk.startsWith('--- '))
    .map(fileOf)
}
