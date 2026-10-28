import { LOCAL_EXECUTION_HOST_ID } from '../../shared/execution-host'
import type {
  BuildWebAgentSessionStatus,
  BuildWebSessionAttentionReason,
  WorktreeBuildWebSession,
  WorktreeBuildWebTask
} from '../../shared/build-web-session-types'
import type { RemoveWorktreeResult } from '../../shared/worktree/create-types'
import type { RuntimeWorktreePsResult } from '../../shared/runtime-worktree-contracts'
import type { Store } from '../persistence'
import { readWorktreeMetaForHost } from '../persistence/host-qualified-worktree-meta'
import type { RemoveManagedWorktreeOptions } from '../runtime/runtime-worktree-selection'
import { queueWorkspaceDelete } from '../runtime/workspaces/workspace-lifecycle-commands'
import {
  readBuildWebWorktreeActivity,
  type BuildWebWorktreeActivityRuntime
} from './build-web-session-activity'
import { checkBuildWebEmptyContainer } from './build-web-empty-container'
import { removeEmptyBuildWebWorktree } from './build-web-session-removal'
import type { BuildWebSessionLinkRuntime } from './build-web-session-link'
import type { BuildWebSessionReportQueue } from './build-web-session-report-queue'
import {
  isWaitAttention,
  sameBuildWebSessionState,
  watchedBuildWebSessionChange
} from './build-web-session-state'
import {
  createBuildWebWorktreeGitProbe,
  type BuildWebTaskWorktreeRef,
  type BuildWebWorktreeGitRuntime
} from './build-web-worktree-git-probe'

// The finisher (IS-147, plan 2.1): a closed task's worktree, once nothing runs in it and nothing is
// in it, is removed; anything else gets attention for a person, with no repair of its own.

export type BuildWebSessionFinisherRuntime = BuildWebWorktreeActivityRuntime &
  BuildWebWorktreeGitRuntime &
  Parameters<typeof queueWorkspaceDelete>[0] &
  Pick<BuildWebSessionLinkRuntime, 'updateManagedWorktreeMeta'> & {
    removeManagedWorktree: (
      selector: string,
      options: RemoveManagedWorktreeOptions
    ) => Promise<RemoveWorktreeResult>
    forceDeletePreservedBranch: (
      selector: string,
      branchName: string,
      expectedHead: string,
      hostId?: string
    ) => Promise<unknown>
  }

export type BuildWebFinisherTarget = BuildWebTaskWorktreeRef & {
  task: WorktreeBuildWebTask & { sessionId: string }
}

export type BuildWebSessionFinisherDeps = {
  runtime: BuildWebSessionFinisherRuntime
  store: Store
  reports: Pick<BuildWebSessionReportQueue, 'hold' | 'release'>
  /** A fresh `eligible` from the console, asked with a timeout just before the delete queue. */
  confirmEligible: (sessionId: string) => Promise<boolean>
  announceRemoved: (removed: { worktreeId: string; key: string }) => void
  /** How long this host waits on a busy or unknown worktree before it needs a person. */
  stuckMs: number
  now?: () => number
}

const LOCAL = LOCAL_EXECUTION_HOST_ID

export class BuildWebSessionFinisher {
  /** Since when each session has been waiting, by this host's clock; a restart starts it over. */
  private readonly waitingSince = new Map<string, number>()
  private readonly running = new Set<string>()
  private stopped = false

  constructor(private readonly deps: BuildWebSessionFinisherDeps) {}

  /** Quit: a look in flight goes no further, and a delete not yet started does not start. */
  stop(): void {
    this.stopped = true
  }

  /** A look or a delete of this worktree is under way. */
  isWorking(worktreeId: string): boolean {
    return this.running.has(worktreeId)
  }

  private now(): number {
    return (this.deps.now ?? Date.now)()
  }

  private readMeta(target: BuildWebFinisherTarget) {
    const meta = readWorktreeMetaForHost(this.deps.store, target.worktreeId, LOCAL)
    // Why: a Keep that landed meanwhile took the worktree out of the task's lifecycle.
    return meta?.buildWebTask?.sessionId === target.task.sessionId ? meta : null
  }

  private async writeSession(
    target: BuildWebFinisherTarget,
    session: Omit<WorktreeBuildWebSession, 'at'> | null
  ): Promise<void> {
    await this.deps.runtime
      .updateManagedWorktreeMeta(`id:${target.worktreeId}`, {
        buildWebSession: session ? { ...session, at: this.now() } : null
      })
      .catch((error) => console.warn('[build-web] could not mark a task worktree:', error))
  }

  private async attention(
    target: BuildWebFinisherTarget,
    reason: BuildWebSessionAttentionReason,
    detail?: string
  ): Promise<void> {
    const meta = this.readMeta(target)
    const session = { state: 'attention' as const, reason, ...(detail ? { detail } : {}) }
    // Why: a long wait is seen again on every poll; clients hear only a change.
    if (meta && !sameBuildWebSessionState(meta.buildWebSession, session)) {
      await this.writeSession(target, session)
    }
  }

  /** A check got past waiting: a wait's attention gives way to what the console says. */
  private async liftWaitAttention(
    target: BuildWebFinisherTarget,
    status: BuildWebAgentSessionStatus
  ): Promise<void> {
    if (!isWaitAttention(this.readMeta(target)?.buildWebSession)) {
      return
    }
    const change = watchedBuildWebSessionChange(undefined, status)
    await this.writeSession(target, change.kind === 'set' ? change.session : null)
  }

  /** The «stuck» clock starts at the first wait this host sees, so a passing failure is no alarm. */
  private async waitOrAttention(
    target: BuildWebFinisherTarget,
    reason: BuildWebSessionAttentionReason
  ): Promise<void> {
    const { sessionId } = target.task
    const since = this.waitingSince.get(sessionId) ?? this.now()
    this.waitingSince.set(sessionId, since)
    if (this.now() - since > this.deps.stuckMs) {
      await this.attention(target, reason)
    }
  }

  /** One eligible session of this host; `ps` is the tick's shared process listing. Never throws. */
  async finish(
    target: BuildWebFinisherTarget,
    status: BuildWebAgentSessionStatus,
    ps?: RuntimeWorktreePsResult
  ): Promise<void> {
    const { worktreeId } = target
    if (this.stopped || this.running.has(worktreeId)) {
      return
    }
    this.running.add(worktreeId)
    try {
      await this.finishUnguarded(target, status, ps)
    } catch (error) {
      console.warn(`[build-web] finishing ${target.task.key}'s worktree failed:`, error)
    } finally {
      this.running.delete(worktreeId)
    }
  }

  private async finishUnguarded(
    target: BuildWebFinisherTarget,
    status: BuildWebAgentSessionStatus,
    ps?: RuntimeWorktreePsResult
  ): Promise<void> {
    const { runtime, store } = this.deps
    const { sessionId } = target.task
    // Why fresh: a Keep or a state write may have landed since the tick listed the worktree.
    const meta = this.readMeta(target)
    if (!meta || meta.isPinned) {
      this.waitingSince.delete(sessionId)
      return
    }
    // Why: attention waits for a person; only a wait's attention is looked at again.
    const current = meta.buildWebSession
    if (current?.state === 'attention' && !isWaitAttention(current)) {
      return
    }
    const activity = await readBuildWebWorktreeActivity(runtime, target.worktreeId, ps)
    if (this.stopped) {
      return
    }
    if (activity.kind === 'busy') {
      return this.waitOrAttention(target, activity.reason)
    }
    const probe = createBuildWebWorktreeGitProbe(runtime, store, target)
    const verdict = await checkBuildWebEmptyContainer(probe)
    if (this.stopped) {
      return
    }
    if (verdict.kind === 'wait') {
      return this.waitOrAttention(target, 'state-unknown')
    }
    this.waitingSince.delete(sessionId)
    if (verdict.kind === 'pinned') {
      return
    }
    if (verdict.kind === 'attention') {
      return this.attention(target, verdict.reason, verdict.detail)
    }
    await this.liftWaitAttention(target, status)
    if (this.stopped || !(await this.deps.confirmEligible(status.id))) {
      return
    }
    const ignored = await probe.readIgnored()
    if (this.stopped) {
      return
    }
    const outcome = await removeEmptyBuildWebWorktree(
      {
        queueDelete: (selector, run) => queueWorkspaceDelete(runtime, selector, LOCAL, {}, run),
        probe: {
          readMeta: () => readWorktreeMetaForHost(store, target.worktreeId, LOCAL),
          activity: () => readBuildWebWorktreeActivity(runtime, target.worktreeId),
          readHead: probe.readHead,
          scanBlockers: probe.scanBlockers
        },
        remove: (selector) =>
          runtime.removeManagedWorktree(selector, {
            runHooks: false,
            waitForBackgroundRemoval: true,
            hostId: LOCAL
          }),
        forceDeleteBranch: (selector, branchName, expectedHead) =>
          runtime.forceDeletePreservedBranch(selector, branchName, expectedHead, LOCAL),
        reports: this.deps.reports,
        stopped: () => this.stopped
      },
      {
        worktreeId: target.worktreeId,
        sessionId,
        branch: target.task.branch,
        head: verdict.head,
        lastActivityAt: meta.lastActivityAt,
        ...(ignored && ignored.length > 0 ? { ignored } : {})
      }
    )
    if (outcome.kind === 'removed') {
      this.deps.announceRemoved({ worktreeId: target.worktreeId, key: target.task.key })
    } else if (outcome.kind === 'failed') {
      // Why no retry: the next delete call would run retryFailedRemoval on its own.
      console.warn(`[build-web] removing ${target.task.key}'s worktree failed:`, outcome.error)
      await this.attention(target, 'remove-failed')
    } else {
      console.info(`[build-web] ${target.task.key}'s worktree stays: ${outcome.why}`)
    }
  }
}
