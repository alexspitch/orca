import type {
  WorkspaceLifecycleHint,
  WorkspaceLifecycleKind
} from '../../../shared/sidebar-list/workspace-lifecycle-hints'
import {
  WORKSPACE_DELETED_ERROR,
  type LifecycleAttempt,
  type LifecycleCommand
} from './workspace-lifecycle-command'

// One workspace's line in the lifecycle queue: what waits, what runs, and what the sidebar shows.

export type LifecycleEntry = {
  kind: WorkspaceLifecycleKind
  /** Arrival order across every workspace, so a command waiting on its lookup keeps its place. */
  seq: number
  state: 'queued' | 'running'
  /** Null for a create, which runs outside the queue between open and close. */
  command: LifecycleCommand<unknown> | null
  reply: Promise<unknown> | null
  settle: (attempt: LifecycleAttempt) => void
  /** Set for a tentative delete; `committed` once it passed its last check. */
  tentative?: { committed: boolean }
}

export type LifecyclePause = {
  kind: WorkspaceLifecycleKind
  observe: (() => Promise<void>) | null
}

export type WorkspaceQueue = {
  entries: LifecycleEntry[]
  paused: LifecyclePause | null
  /** A finished create or delete, held until a fresh listing shows its membership. */
  settling: number
  draining: boolean
  /** Ends a wait on the pause early: a forced delete arrived. */
  wake: (() => void) | null
}

/** A delete that ends the workspace from the moment it is accepted; a tentative one does not. */
export function isFinalDelete(entry: LifecycleEntry): boolean {
  return entry.kind === 'delete' && !entry.tentative
}

function deletedAttempt(): LifecycleAttempt {
  return { outcome: 'settled', error: new Error(WORKSPACE_DELETED_ERROR), threw: true }
}

/** Takes the queued entries `which` picks out of line, each refused as deleted. */
export function cancelQueued(
  queue: WorkspaceQueue,
  which: (entry: LifecycleEntry) => boolean = () => true
): void {
  const cancelled = queue.entries.filter((entry) => entry.state === 'queued' && which(entry))
  queue.entries = queue.entries.filter((entry) => !cancelled.includes(entry))
  for (const entry of cancelled) {
    entry.settle(deletedAttempt())
  }
}

/** The workspace is gone: a person's delete still waiting gets that delete's result, anything else is refused. */
export function settleBehindDelete(queue: WorkspaceQueue, deleted: LifecycleAttempt): void {
  const waiting = queue.entries.filter((entry) => entry.state === 'queued')
  queue.entries = queue.entries.filter((entry) => entry.state !== 'queued')
  for (const entry of waiting) {
    entry.settle(isFinalDelete(entry) ? deleted : deletedAttempt())
  }
}

/** A tentative delete stays out of sight until it passed its last check: it may still step aside. */
export function workspaceQueueHint(queue: WorkspaceQueue): WorkspaceLifecycleHint | undefined {
  const shown = queue.entries.filter((entry) => !entry.tentative || entry.tentative.committed)
  const deleting = shown.some((entry) => entry.kind === 'delete')
  const kind = deleting ? 'delete' : (shown[0]?.kind ?? queue.paused?.kind)
  if (kind === undefined) {
    // Only a settling delete is left: it shows until its row leaves the listing.
    return queue.settling > 0 ? { kind: 'delete', queuedBehind: 0 } : undefined
  }
  return {
    kind,
    queuedBehind: deleting ? 0 : Math.max(0, shown.length - 1),
    ...(queue.paused ? { paused: true as const } : {})
  }
}
