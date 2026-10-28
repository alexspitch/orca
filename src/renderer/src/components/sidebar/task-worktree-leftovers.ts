import { useAppStore } from '@/store'
import {
  getConnectionIdForWorktreeCopy,
  getConnectionIdFromState
} from '@/lib/connection-owner-resolution'
import { runtimeTargetForWorkspaceOwner } from '@/lib/resolve-owner'
import { ipcOrRuntimeTargetForHostId } from '@/runtime/runtime-client-target'
import type { RuntimeGitContext } from '@/runtime/runtime-git-client-context'
import { getRuntimeGitBranchCompare } from '@/runtime/runtime-git-diff-client'
import { getRuntimeGitHistory, getRuntimeGitStatus } from '@/runtime/runtime-git-status-client'
import type { Worktree } from '../../../../shared/worktree/types'

// IS-147 «Remove anyway»: what a closed task's worktree still holds — the branch's own commits over
// the worktree's base, and the files a removal loses.

/** The most lines a section lists; the rest is a count. */
export const LEFTOVER_LINES_LISTED = 12

export type TaskWorktreeLeftovers = {
  /** The branch's own commits, newest first, and how many there are; null when unreadable. */
  commits: { lines: string[]; total: number } | null
  files: string[] | null
}

function gitContext(worktree: Worktree): RuntimeGitContext | null {
  const state = useAppStore.getState()
  // Route by the worktree's own host; a host-qualified copy names it, a bare row resolves its owner.
  const target = worktree.hostId
    ? ipcOrRuntimeTargetForHostId(worktree.hostId)
    : runtimeTargetForWorkspaceOwner(state, { workspaceId: worktree.id })
  if (!target) {
    return null
  }
  const connectionId = worktree.hostId
    ? getConnectionIdForWorktreeCopy(state, worktree.id, worktree.hostId)
    : getConnectionIdFromState(state, worktree.id)
  return {
    target,
    worktreeId: worktree.id,
    worktreePath: worktree.path,
    connectionId: connectionId ?? undefined
  }
}

/** Why the compare: a task branch tracks no upstream, so only `baseRef` says where its own commits start. */
async function readOwnCommits(
  context: RuntimeGitContext,
  baseRef: string
): Promise<TaskWorktreeLeftovers['commits']> {
  const { summary } = await getRuntimeGitBranchCompare(context, baseRef)
  if (summary.status !== 'ready' || summary.commitsAhead === undefined) {
    return null
  }
  const total = summary.commitsAhead
  if (total === 0) {
    return { lines: [], total }
  }
  const shown = Math.min(total, LEFTOVER_LINES_LISTED)
  const history = await getRuntimeGitHistory(context, { limit: shown + 1 })
  const baseIndex = summary.mergeBase
    ? history.items.findIndex((item) => item.id === summary.mergeBase)
    : -1
  const own = history.items.slice(0, baseIndex >= 0 ? Math.min(baseIndex, shown) : shown)
  return {
    lines: own.map((item) => `${item.displayId ?? item.id.slice(0, 7)} ${item.subject}`),
    total
  }
}

/** Reads both on the worktree's host; a part that cannot be read comes back null. */
export async function readTaskWorktreeLeftovers(
  worktree: Worktree
): Promise<TaskWorktreeLeftovers> {
  const context = gitContext(worktree)
  if (!context) {
    return { commits: null, files: null }
  }
  const [commits, status] = await Promise.all([
    worktree.baseRef
      ? readOwnCommits(context, worktree.baseRef).catch(() => null)
      : Promise.resolve(null),
    getRuntimeGitStatus(context, { admissionTier: 'interactive', includeLineStats: false }).catch(
      () => null
    )
  ])
  return {
    commits,
    files: status?.entries.map((entry) => `${entry.status} ${entry.path}`) ?? null
  }
}
