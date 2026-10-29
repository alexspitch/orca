import type { WorkspaceLifecycleKind } from '../../../shared/sidebar-list/workspace-lifecycle-hints'

export const WORKSPACE_DELETED_ERROR = 'workspace_deleted'

/** `unverifiable`: the execution host never confirmed the outcome, so the queue pauses. */
export type LifecycleOutcome = 'settled' | 'unverifiable'

/** Equal pending deletes join; different options are refused. */
export type LifecycleDeleteOptions = {
  key: string
  /** Force Delete/--force explicitly bypasses a paused queue. */
  force: boolean
  label: string
  /**
   * The host's own cleanup, which may still step aside: it cancels and refuses nothing, and what
   * arrives while it runs waits behind it; a person's delete replaces it while it has not started.
   * It shows as deleting once it calls `committed`.
   */
  tentative?: boolean
}

/** Handed to a running command. */
export type LifecycleRunControl = {
  /** A tentative delete passed its last check; from here the workspace shows as deleting. */
  committed: () => void
}

/** For a command run with no queue: there is no hint to update. */
export const UNQUEUED_RUN: LifecycleRunControl = { committed: () => {} }

export type LifecycleCommand<T> = {
  kind: Exclude<WorkspaceLifecycleKind, 'create'>
  run: (control: LifecycleRunControl) => Promise<T>
  outcome?: (result: T) => LifecycleOutcome
  /** Whether a thrown error means contact was lost mid-run rather than a definite failure. */
  lostContact?: (error: unknown) => boolean
  observe?: () => Promise<void>
  delete?: LifecycleDeleteOptions
}

export type LifecycleMembership = (done: () => void) => void

export type LifecycleAttempt = {
  outcome: LifecycleOutcome
  value?: unknown
  error?: unknown
  threw: boolean
}

export async function attemptLifecycleCommand(
  command: LifecycleCommand<unknown>,
  control: LifecycleRunControl
): Promise<LifecycleAttempt> {
  try {
    const value = await command.run(control)
    return { outcome: command.outcome?.(value) ?? 'settled', value, threw: false }
  } catch (error) {
    return {
      outcome: command.lostContact?.(error) ? 'unverifiable' : 'settled',
      error,
      threw: true
    }
  }
}
