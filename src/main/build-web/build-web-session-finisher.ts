import { LOCAL_EXECUTION_HOST_ID } from '../../shared/execution-host'
import type {
  BuildWebAgentSessionStatus,
  BuildWebSessionAttentionReason,
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
  /** How long a closed task may keep something running before it needs a person. */
  stuckMs: number
  now?: () => number
}

const LOCAL = LOCAL_EXECUTION_HOST_ID

function consoleTime(value: string | null): number | null {
  const at = value ? Date.parse(value) : Number.NaN
  return Number.isFinite(at) ? at : null
}

export class BuildWebSessionFinisher {
  private readonly firstSeenEligibleAt = new Map<string, number>()
  private readonly running = new Set<string>()

  constructor(private readonly deps: BuildWebSessionFinisherDeps) {}

  private now(): number {
    return (this.deps.now ?? Date.now)()
  }

  private async attention(
    target: BuildWebFinisherTarget,
    reason: BuildWebSessionAttentionReason,
    detail?: string
  ): Promise<void> {
    const meta = readWorktreeMetaForHost(this.deps.store, target.worktreeId, LOCAL)
    // Why: a Keep that landed meanwhile took the worktree out of the task's lifecycle.
    if (meta?.buildWebTask?.sessionId !== target.task.sessionId) {
      return
    }
    const session = { state: 'attention' as const, reason, ...(detail ? { detail } : {}) }
    await this.deps.runtime
      .updateManagedWorktreeMeta(`id:${target.worktreeId}`, {
        buildWebSession: { ...session, at: this.now() }
      })
      .catch((error) => console.warn('[build-web] could not mark a task worktree:', error))
  }

  /** Since when the task was ready for cleanup: the console's clock when it says, else first seen here. */
  private eligibleSince(status: BuildWebAgentSessionStatus): number {
    const firstSeen = this.firstSeenEligibleAt.get(status.id) ?? this.now()
    this.firstSeenEligibleAt.set(status.id, firstSeen)
    const times = [consoleTime(status.closed_since), consoleTime(status.agent_finished_at)]
    const known = times.filter((at): at is number => at !== null)
    return known.length > 0 ? Math.max(...known) : firstSeen
  }

  private async waitOrAttention(
    target: BuildWebFinisherTarget,
    status: BuildWebAgentSessionStatus,
    reason: BuildWebSessionAttentionReason
  ): Promise<void> {
    if (this.now() - this.eligibleSince(status) > this.deps.stuckMs) {
      await this.attention(target, reason)
    }
  }

  /** One eligible session of this host; `ps` is the tick's shared process listing. */
  async finish(
    target: BuildWebFinisherTarget,
    status: BuildWebAgentSessionStatus,
    ps?: RuntimeWorktreePsResult
  ): Promise<void> {
    const { worktreeId } = target
    if (this.running.has(worktreeId)) {
      return
    }
    this.running.add(worktreeId)
    try {
      await this.finishUnguarded(target, status, ps)
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
    // Why fresh: a Keep or a state write may have landed since the tick listed the worktree.
    const meta = readWorktreeMetaForHost(store, target.worktreeId, LOCAL)
    if (
      meta?.buildWebTask?.sessionId !== target.task.sessionId ||
      meta.isPinned ||
      // Why: attention waits for a person; there is no automatic repair or retry.
      meta.buildWebSession?.state === 'attention'
    ) {
      return
    }
    const activity = await readBuildWebWorktreeActivity(runtime, target.worktreeId, ps)
    if (activity.kind === 'busy') {
      return this.waitOrAttention(target, status, activity.reason)
    }
    const probe = createBuildWebWorktreeGitProbe(runtime, store, target)
    const verdict = await checkBuildWebEmptyContainer(probe)
    if (verdict.kind === 'pinned') {
      return
    }
    if (verdict.kind === 'wait') {
      return this.waitOrAttention(target, status, 'state-unknown')
    }
    if (verdict.kind === 'attention') {
      return this.attention(target, verdict.reason, verdict.detail)
    }
    if (!(await this.deps.confirmEligible(status.id))) {
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
        reports: this.deps.reports
      },
      {
        worktreeId: target.worktreeId,
        sessionId: target.task.sessionId,
        branch: target.task.branch,
        head: verdict.head,
        lastActivityAt: meta.lastActivityAt
      }
    )
    if (outcome.kind === 'removed') {
      this.firstSeenEligibleAt.delete(status.id)
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
