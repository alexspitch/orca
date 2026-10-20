import type { PreloadApi } from '../../../../preload/api-types'
import { toRuntimeWorktreeSelector } from '../../runtime/runtime-worktree-selector'
import { callRuntimeResult } from './web-runtime-calls'
import { resolveRuntimeWorktreeByPath } from './web-runtime-worktree-catalog'

type FromBase = PreloadApi['git']['rebaseFromBase']

function fromBase(method: 'git.rebaseFromBase' | 'git.mergeFromBase'): FromBase {
  return async ({ worktreePath, baseRef }) => {
    const worktree = await resolveRuntimeWorktreeByPath(worktreePath)
    await callRuntimeResult(method, { worktree: toRuntimeWorktreeSelector(worktree.id), baseRef })
  }
}

/** The web client's updates from the base: a rebase, or a pull (fast-forward, else a merge). */
export const rebaseFromBase = fromBase('git.rebaseFromBase')
export const mergeFromBase = fromBase('git.mergeFromBase')
