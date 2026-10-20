import type { PreloadApi } from '../../../../preload/api-types'
import { toRuntimeWorktreeSelector } from '../../runtime/runtime-worktree-selector'
import { callRuntimeResult } from './web-runtime-calls'
import { resolveRuntimeWorktreeByPath } from './web-runtime-worktree-catalog'

/** The web client's `git.fileBlame`: the paired host blames the editor's text. */
export const fileBlame: PreloadApi['git']['fileBlame'] = async ({
  worktreePath,
  relativePath,
  contents
}) => {
  const worktree = await resolveRuntimeWorktreeByPath(worktreePath)
  return callRuntimeResult('git.fileBlame', {
    worktree: toRuntimeWorktreeSelector(worktree.id),
    relativePath,
    contents
  })
}
