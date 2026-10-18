import type { RuntimeGitContext } from '@/runtime/runtime-git-client-context'
import { getRuntimeGitCommitDiff } from '@/runtime/runtime-git-diff-client'
import { buildGitLogCommitTree, gitLogFilesInTreeOrder } from './git-log-commit-files'
import { loadChangedPaths, loadWorkingTreeDiff } from './git-log-operations-client'
import type { GitLogDiffTarget } from './GitLogDiffDialog'

// Why numbered: the working tree changes between two Compare with Local, so each gets its own models.
let localComparisons = 0

/** Compare with Local / Show Diff with Working Tree; null when nothing differs. */
export async function workingTreeDiffTarget(
  context: RuntimeGitContext,
  base: string,
  subtitle: string
): Promise<GitLogDiffTarget | null> {
  const paths = await loadChangedPaths(context, base, null)
  if (paths.length === 0) {
    return null
  }
  return {
    key: `local:${base}:${++localComparisons}`,
    subtitle,
    files: gitLogFilesInTreeOrder(buildGitLogCommitTree(paths)),
    index: 0,
    load: (entry) => loadWorkingTreeDiff(context, base, entry)
  }
}

/** Compare with 'current': what `target` has that `base` doesn't; null when they match. */
export async function revisionsDiffTarget(
  context: RuntimeGitContext,
  base: string,
  target: string,
  subtitle: string
): Promise<GitLogDiffTarget | null> {
  const paths = await loadChangedPaths(context, base, target)
  if (paths.length === 0) {
    return null
  }
  return {
    key: `compare:${base}:${target}`,
    subtitle,
    files: gitLogFilesInTreeOrder(buildGitLogCommitTree(paths)),
    index: 0,
    load: (entry) =>
      getRuntimeGitCommitDiff(context, {
        commitOid: target,
        parentOid: base,
        filePath: entry.path,
        oldPath: entry.oldPath
      })
  }
}
