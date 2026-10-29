import type { WorktreeMeta } from '../../shared/worktree/meta-types'
import type { RemoveWorktreeResult } from '../../shared/worktree/create-types'
import type { WorkspaceCleanupBlocker } from '../../shared/workspace-cleanup'
import type { BuildWebWorktreeActivity } from './build-web-session-activity'
import type { BuildWebWorktreeHead } from './build-web-empty-container'
import type { BuildWebSessionReportQueue } from './build-web-session-report-queue'
import { beginBuildWebRemoval, isBuildWebKeepInProgress } from './build-web-task-worktree-claims'

// The finisher's delete of an empty task worktree (IS-147, plan 2.1 steps 4–5), and the frame the
// host's other task-worktree delete shares. It runs inside the workspace delete queue as a tentative
// delete, where only local checks run; a throw cancels it, a return is the delete. The task link,
// the pin and a Keep are read last, with no await before the delete itself.

export class BuildWebRemovalCancelled extends Error {
  constructor(why: string) {
    super(why)
    this.name = 'BuildWebRemovalCancelled'
  }
}

export type BuildWebStillEmptyProbe = {
  readMeta: () => Pick<WorktreeMeta, 'buildWebTask' | 'lastActivityAt' | 'isPinned'> | undefined
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
  /** Top-most entries Git ignores: the delete loses them, so the report names them. */
  ignored?: readonly string[]
}

function whyMetaChanged(
  meta: ReturnType<BuildWebStillEmptyProbe['readMeta']>,
  expected: BuildWebEmptyWorktree
): string | null {
  if (meta?.buildWebTask?.sessionId !== expected.sessionId) {
    return 'the worktree no longer holds this session'
  }
  if (meta.isPinned) {
    return 'the worktree was pinned'
  }
  if (meta.lastActivityAt !== expected.lastActivityAt) {
    return 'the worktree was used'
  }
  return null
}

/** Git first, activity last: the slow scan must not be what the delete last looked at. */
async function whyNotStillEmpty(
  probe: BuildWebStillEmptyProbe,
  expected: BuildWebEmptyWorktree
): Promise<string | null> {
  const changed = whyMetaChanged(probe.readMeta(), expected)
  if (changed) {
    return changed
  }
  const head = await probe.readHead()
  if (head?.ref !== expected.head.ref || head?.sha !== expected.head.sha) {
    return 'HEAD moved'
  }
  // Why `pinned` counts: a pin taken while the delete waited keeps the worktree.
  const blockers = await probe.scanBlockers()
  if (blockers?.includes('pinned')) {
    return 'the worktree was pinned'
  }
  if (!blockers || blockers.length > 0) {
    return 'the worktree is no longer clean'
  }
  if ((await probe.activity()).kind !== 'idle') {
    return 'something runs in the worktree'
  }
  return null
}

export type BuildWebSessionRemovalDeps = {
  /** The workspace delete queue: the task runs in the worktree's turn; `committed` shows it deleting. */
  queueDelete: <T>(selector: string, run: (committed: () => void) => Promise<T>) => Promise<T>
  probe: BuildWebStillEmptyProbe
  remove: (selector: string) => Promise<RemoveWorktreeResult>
  forceDeleteBranch: (selector: string, branchName: string, head: string) => Promise<unknown>
  reports: Pick<BuildWebSessionReportQueue, 'hold' | 'release'>
  /** The host is shutting down: a delete that has not started stays undone. */
  stopped: () => boolean
}

/** The checks with no await, run last: nothing can land between them and the delete. */
export function whyNotRemoveNow(
  deps: Pick<BuildWebSessionRemovalDeps, 'stopped'>,
  worktreeId: string,
  whyChanged: () => string | null
): string | null {
  if (isBuildWebKeepInProgress(worktreeId)) {
    return 'a person is keeping the worktree'
  }
  if (deps.stopped()) {
    return 'the host is stopping'
  }
  return whyChanged()
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

const IGNORED_NAMED = 5

function ignoredNote(ignored: readonly string[] | undefined): string | undefined {
  if (!ignored || ignored.length === 0) {
    return undefined
  }
  const more = ignored.length > IGNORED_NAMED ? ` (+${ignored.length - IGNORED_NAMED} more)` : ''
  return `ignored files lost: ${ignored.slice(0, IGNORED_NAMED).join(', ')}${more}`
}

export type BuildWebTaskRemovalSteps = {
  /** Checks that await, run first in the worktree's turn; a reason cancels the delete. */
  slowChecks: () => Promise<string | null>
  /** Checks with no await, run right before the delete. */
  lastChecks: () => string | null
  /** The report's note, once the delete is done. */
  notes: (selector: string, result: RemoveWorktreeResult) => Promise<(string | undefined)[]>
  /** The report says the worktree went behind Orca's back. */
  external?: boolean
}

/**
 * One task worktree's delete by this host: the report waits until its note is known, the checks
 * run in the worktree's turn, and a Keep is refused from the last check on.
 */
export async function removeBuildWebTaskWorktree(
  deps: Pick<BuildWebSessionRemovalDeps, 'queueDelete' | 'remove' | 'reports'>,
  target: { worktreeId: string; sessionId: string },
  steps: BuildWebTaskRemovalSteps
): Promise<BuildWebSessionRemovalOutcome> {
  const selector = `id:${target.worktreeId}`
  let note: string | undefined
  let external: true | undefined
  let started = false
  let releaseRemoval = (): void => {}
  // Why held: the delete enqueues the report; it waits here until the note about the branch is known.
  deps.reports.hold(target.sessionId)
  try {
    const result = await deps.queueDelete(selector, async (committed) => {
      started = true
      const why = (await steps.slowChecks()) ?? steps.lastChecks()
      if (why) {
        throw new BuildWebRemovalCancelled(why)
      }
      // Why no await between the last check and the delete: a Keep or a pin would slip in.
      releaseRemoval = beginBuildWebRemoval(target.worktreeId)
      committed()
      return deps.remove(selector)
    })
    const notes = (await steps.notes(selector, result)).filter((part): part is string =>
      Boolean(part)
    )
    note = notes.length > 0 ? notes.join('; ') : undefined
    external = steps.external ? true : undefined
    return { kind: 'removed', ...(note ? { note } : {}) }
  } catch (error) {
    const why = error instanceof Error ? error.message : String(error)
    // Why `started`: a queue that settles the delete unrun (a person's delete is on its way, or the
    // workspace is already gone) attempted nothing.
    if (error instanceof BuildWebRemovalCancelled || !started) {
      return { kind: 'cancelled', why }
    }
    return { kind: 'failed', error: why }
  } finally {
    releaseRemoval()
    deps.reports.release(target.sessionId, note, external)
  }
}

export function removeEmptyBuildWebWorktree(
  deps: BuildWebSessionRemovalDeps,
  target: BuildWebEmptyWorktree
): Promise<BuildWebSessionRemovalOutcome> {
  return removeBuildWebTaskWorktree(deps, target, {
    slowChecks: () => whyNotStillEmpty(deps.probe, target),
    lastChecks: () =>
      whyNotRemoveNow(deps, target.worktreeId, () => whyMetaChanged(deps.probe.readMeta(), target)),
    notes: async (selector, result) => [
      await settleTaskBranch(deps, selector, target, result.preservedBranch),
      ignoredNote(target.ignored)
    ]
  })
}
