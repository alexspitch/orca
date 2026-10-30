import {
  buildSourceControlTree,
  compactSourceControlTree,
  type SourceControlTreeNode
} from '@/components/right-sidebar/source-control-tree'
import type { DiffFile } from './commit-diff-rows'

export type CommitFileEntry = { path: string; index: number; file: DiffFile }
export type CommitFileNode = SourceControlTreeNode<CommitFileEntry, 'commit'>

/** A commit's files as Source Control lists them: folders first, single-folder chains joined. */
export function commitFileTreeOf(files: readonly DiffFile[]): CommitFileNode[] {
  return compactSourceControlTree(
    buildSourceControlTree(
      'commit',
      files.map((file, index) => ({ path: file.path, index, file }))
    )
  )
}

/** The file the tree shows first, opened before one is picked. */
export function firstFileIndexOf(nodes: readonly CommitFileNode[]): number | null {
  for (const node of nodes) {
    const index = node.type === 'file' ? node.entry.index : firstFileIndexOf(node.children)
    if (index !== null) {
      return index
    }
  }
  return null
}
