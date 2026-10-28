import type { WorktreeMeta } from '../../shared/worktree/meta-types'
import type { RemoveWorktreeResult } from '../../shared/worktree/create-types'
import type { WorkspaceCleanupBlocker } from '../../shared/workspace-cleanup'
import type { BuildWebWorktreeActivity } from './build-web-session-activity'
import type { BuildWebWorktreeHead } from './build-web-empty-container'
import type { BuildWebSessionReportQueue } from './build-web-session-report-queue'

// The finisher's delete of an empty task worktree (IS-147, plan 2.1 steps 4–5). It runs inside the
// workspace delete queue, where only local checks run; a throw cancels it, a return is the delete.

export class BuildWebRemovalCancelled extends Error {
  constructor(why: string) {
    super(why)
    this.name = 'BuildWebRemovalCancelled'
  }
}

export type BuildWebStillEmptyProbe = {
  readMeta: () => Pick<WorktreeMeta, 'buildWebTask' | 'lastActivityAt'> | undefined
  activity: () => Promise<BuildWebWorktreeActivity>
  readHead: () => Promise<BuildWebWorktreeHead | null>
  scanBlockers: () => Promise<readonly WorkspaceCleanupBlocker[] | null>
}

export type BuildWebEmptyWorktree = {
  worktreeId: string
  sessionId: string
  branch: string
  head: BuildWebWorktreeHead
  lastActivityAt: number
}

/** Why the worktree is no longer the empty one that was checked, or null when it still is. */
export async function whyNotStillEmpty(
  probe: BuildWebStillEmptyProbe,
  expected: BuildWebEmptyWorktree
): Promise<string | null> {
  const meta = probe.readMeta()
  if (meta?.buildWebTask?.sessionId !== expected.sessionId) {
    return 'the worktree no longer holds this session'
  }
  if (meta.lastActivityAt !== expected.lastActivityAt) {
    return 'the worktree was used'
  }
  if ((await probe.activity()).kind !== 'idle') {
    return 'something runs in the worktree'
  }
  const head = await probe.readHead()
  if (head?.ref !== expected.head.ref || head?.sha !== expected.head.sha) {
    return 'HEAD moved'
  }
  const blockers = (await probe.scanBlockers())?.filter((blocker) => blocker !== 'pinned')
  return blockers && blockers.length === 0 ? null : 'the worktree is no longer clean'
}

export type BuildWebSessionRemovalDeps = {
  /** The workspace delete queue: the task runs when the worktree's turn comes. */
  queueDelete: <T>(selector: string, run: () => Promise<T>) => Promise<T>
  probe: BuildWebStillEmptyProbe
  remove: (selector: string) => Promise<RemoveWorktreeResult>
  forceDeleteBranch: (selector: string, branchName: string, head: string) => Promise<unknown>
  reports: Pick<BuildWebSessionReportQueue, 'hold' | 'release'>
}

export type BuildWebSessionRemovalOutcome =
  | { kind: 'removed'; note?: string }
  | { kind: 'cancelled'; why: string }
  | { kind: 'failed'; error: string }

/**
 * Orca's own branch, left by a `-d` that refused (Git before 2.38 judges against the main HEAD):
 * deleted when it is the task's branch at the head proven to add nothing, otherwise named in the note.
 */
async function settleTaskBranch(
  deps: Pick<BuildWebSessionRemovalDeps, 'forceDeleteBranch'>,
  selector: string,
  target: BuildWebEmptyWorktree,
  preserved: RemoveWorktreeResult['preservedBranch']
): Promise<string | undefined> {
  if (!preserved) {
    return undefined
  }
  const head = preserved.head ?? target.head.sha
  if (preserved.branchName === target.branch && head === target.head.sha) {
    try {
      await deps.forceDeleteBranch(selector, preserved.branchName, head)
      return undefined
    } catch (error) {
      console.warn(`[build-web] could not delete branch ${preserved.branchName}:`, error)
    }
  }
  return `branch kept: ${preserved.branchName}`
}

export async function removeEmptyBuildWebWorktree(
  deps: BuildWebSessionRemovalDeps,
  target: BuildWebEmptyWorktree
): Promise<BuildWebSessionRemovalOutcome> {
  const selector = `id:${target.worktreeId}`
  let note: string | undefined
  // Why held: the delete enqueues the report; it waits here until the note about the branch is known.
  deps.reports.hold(target.sessionId)
  try {
    const result = await deps.queueDelete(selector, async () => {
      const why = await whyNotStillEmpty(deps.probe, target)
      if (why) {
        throw new BuildWebRemovalCancelled(why)
      }
      return deps.remove(selector)
    })
    note = await settleTaskBranch(deps, selector, target, result.preservedBranch)
    return { kind: 'removed', ...(note ? { note } : {}) }
  } catch (error) {
    if (error instanceof BuildWebRemovalCancelled) {
      return { kind: 'cancelled', why: error.message }
    }
    return { kind: 'failed', error: error instanceof Error ? error.message : String(error) }
  } finally {
    deps.reports.release(target.sessionId, note)
  }
}
