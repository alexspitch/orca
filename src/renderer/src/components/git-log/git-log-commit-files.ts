import type { GitBranchChangeEntry } from '../../../../shared/git-diff-compare-types'
import {
  buildSourceControlTree,
  compactSourceControlTree,
  type SourceControlTreeNode
} from '../right-sidebar/source-control-tree'

export type GitLogCommitTreeNode = SourceControlTreeNode<GitBranchChangeEntry, 'commit'>

/** A commit's changed files as the Changes pane draws them, folder chains compacted. */
export function buildGitLogCommitTree(entries: GitBranchChangeEntry[]): GitLogCommitTreeNode[] {
  return compactSourceControlTree(buildSourceControlTree('commit', entries))
}

/** The files in the order the tree shows them, which Previous/Next File follows. */
export function gitLogFilesInTreeOrder(
  nodes: readonly GitLogCommitTreeNode[],
  files: GitBranchChangeEntry[] = []
): GitBranchChangeEntry[] {
  for (const node of nodes) {
    if (node.type === 'file') {
      files.push(node.entry)
    } else {
      gitLogFilesInTreeOrder(node.children, files)
    }
  }
  return files
}
