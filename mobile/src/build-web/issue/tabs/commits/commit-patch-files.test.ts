import { describe, expect, it } from 'vitest'
import { commitPatchFiles } from './commit-patch-files'

const PATCH = [
  'diff --git a/src/a.ts b/src/a.ts',
  'index 1..2 100644',
  '--- a/src/a.ts',
  '+++ b/src/a.ts',
  '@@ -3,3 +3,3 @@ fn',
  ' keep',
  '-old',
  '+new',
  '--- not a header',
  'diff --git a/gone.md b/gone.md',
  'deleted file mode 100644',
  '--- a/gone.md',
  '+++ /dev/null',
  '@@ -1 +0,0 @@',
  '-bye',
  ''
].join('\n')

describe('commitPatchFiles', () => {
  it('reads each file with numbered lines and its status', () => {
    const [changed, deleted] = commitPatchFiles(PATCH)
    expect(changed).toMatchObject({ path: 'src/a.ts', status: 'changed', added: 1, removed: 2 })
    expect(changed!.lines.slice(1, 4)).toEqual([
      { kind: 'context', text: 'keep', oldLineNumber: 3, newLineNumber: 3 },
      { kind: 'delete', text: 'old', oldLineNumber: 4 },
      { kind: 'add', text: 'new', newLineNumber: 4 }
    ])
    expect(deleted).toMatchObject({ path: 'gone.md', status: 'deleted', added: 0, removed: 1 })
  })

  it('reads a plain unified patch without git headers', () => {
    const files = commitPatchFiles('--- a/x.txt\n+++ b/x.txt\n@@ -1 +1 @@\n-a\n+b\n')
    expect(files).toMatchObject([{ path: 'x.txt', added: 1, removed: 1 }])
  })
})
