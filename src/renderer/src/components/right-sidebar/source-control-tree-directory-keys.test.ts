import { describe, expect, it } from 'vitest'
import { buildSourceControlTree, flattenSourceControlTree } from './source-control-tree'
import {
  collectSourceControlTreeDirectoryKeys,
  sectionTreeDirectoryKeys
} from './source-control-tree-directory-keys'

const roots = buildSourceControlTree('branch', [
  { path: 'src/a/x.ts' },
  { path: 'src/b/y.ts' },
  { path: 'docs/z.md' },
  { path: 'README.md' }
])

describe('source control folder keys', () => {
  it('lists a folder and everything below it', () => {
    const src = roots.find((n) => n.name === 'src')
    expect(src?.type).toBe('directory')
    const below =
      src?.type === 'directory' ? collectSourceControlTreeDirectoryKeys(src.children) : []
    expect(below).toHaveLength(2)
  })

  it('finds every folder of a section even when some are closed', () => {
    const src = roots.find((n) => n.name === 'src')!
    const rows = flattenSourceControlTree(roots, new Set([src.key]))
    expect(sectionTreeDirectoryKeys(rows)).toHaveLength(4)
  })
})
