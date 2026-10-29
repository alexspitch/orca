import {
  BUILD_WEB_AGENT_SESSION_LIFECYCLE_FEATURE,
  type BuildWebAgentSessionStatus
} from '../../shared/build-web-session-types'
import type { BuildWebIssueDetail } from '../../shared/build-web-types'
import { LOCAL_EXECUTION_HOST_ID } from '../../shared/execution-host'
import type { Store } from '../persistence'
import { readWorktreeMetaForHost } from '../persistence/host-qualified-worktree-meta'
import { buildWebConsoleFeatures, getBuildWebStatus } from './build-web-connection'
import { fetchBuildWebAgentSessions } from './build-web-agent-sessions'
import { getBuildWebIssue } from './build-web-issue-read'
import {
  BUILD_WEB_WORKTREE_PS_LIMIT,
  type BuildWebWorktreeActivityRuntime
} from './build-web-session-activity'
import {
  BuildWebSessionFinisher,
  type BuildWebSessionFinisherDeps,
  type BuildWebSessionFinisherRuntime
} from './build-web-session-finisher'
import { healBuildWebSessionLink, type BuildWebSessionHealRuntime } from './build-web-session-heal'
import type { BuildWebSessionReportQueue } from './build-web-session-report-queue'
import { watchedBuildWebSessionChange } from './build-web-session-state'
import {
  hasBuildWebSession,
  isBuildWebTaskWorktreeBeingRemoved,
  isBuildWebTaskWorktreeGone,
  listLocalBuildWebTaskWorktrees,
  type BuildWebLinkedTaskWorktree,
  type BuildWebTaskWorktree
} from './build-web-task-worktrees'

// The host's watch over its task worktrees (IS-147, plan 1.5): it drains the report queue, mirrors
// the console's session state into worktree meta, heals missing links, and hands the finisher both
// eligible sessions and worktrees whose folder was deleted behind Orca's back.

export type BuildWebSessionWatcherRuntime = BuildWebSessionFinisherRuntime &
  BuildWebSessionHealRuntime &
  BuildWebWorktreeActivityRuntime

export type BuildWebSessionWatcherDeps = Pick<
  BuildWebSessionFinisherDeps,
  'announceRemoved' | 'stuckMs'
> & {
  runtime: BuildWebSessionWatcherRuntime
  store: Store
  reports: BuildWebSessionReportQueue
  pollMs: number
}

const HEAL_RETRY_MS = 10 * 60_000
const CONFIRM_TIMEOUT_MS = 10_000
// Why several: a folder missing once may be a volume still mounting; the cleanup is not undone.
const GONE_LOOKS = 3

const readIssueInBackground = (issueId: string): Promise<BuildWebIssueDetail> =>
  getBuildWebIssue(issueId, undefined, { background: true })

export class BuildWebSessionWatcher {
  private timer: NodeJS.Timeout | null = null
  private ticking: Promise<void> | null = null
  private stopped = false
  private readonly finisher: BuildWebSessionFinisher
  private readonly goneTried = new Set<string>()
  /** How many looks in a row found each session's folder gone. */
  private readonly goneLooks = new Map<string, number>()
  private readonly healTriedAt = new Map<string, number>()
  private readonly unlinkedNoted = new Set<string>()

  constructor(private readonly deps: BuildWebSessionWatcherDeps) {
    this.finisher = new BuildWebSessionFinisher({
      runtime: deps.runtime,
      store: deps.store,
      reports: deps.reports,
      stuckMs: deps.stuckMs,
      announceRemoved: deps.announceRemoved,
      confirmEligible: async (sessionId) => {
        const lookup = await fetchBuildWebAgentSessions([sessionId], {
          background: true,
          timeoutMs: CONFIRM_TIMEOUT_MS
        }).catch(() => null)
        const session = lookup?.sessions.find((s) => s.id === sessionId)
        return Boolean(session?.eligible && lookup?.settings.auto_cleanup)
      }
    })
  }

  /** Reports left by the last run go out now; the first full look waits one interval. */
  start(): void {
    void this.deps.reports.drain().catch(() => {})
    this.timer = setInterval(() => void this.tick(), this.deps.pollMs)
    this.timer.unref?.()
  }

  /** Quit: a tick in flight writes and deletes nothing more. */
  stop(): void {
    this.stopped = true
    this.finisher.stop()
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  tick(): Promise<void> {
    if (this.stopped) {
      return Promise.resolve()
    }
    this.ticking ??= this.look()
      .catch((error) => console.warn('[build-web] session watch failed:', error))
      .finally(() => {
        this.ticking = null
      })
    return this.ticking
  }

  private async look(): Promise<void> {
    await this.deps.reports.drain()
    const consoleHost = getBuildWebStatus().baseUrl
    const rows = consoleHost ? listLocalBuildWebTaskWorktrees(this.deps.store, consoleHost) : []
    if (rows.length === 0 || this.stopped) {
      return
    }
    const features = await buildWebConsoleFeatures({ background: true }).catch((): string[] => [])
    if (!features.includes(BUILD_WEB_AGENT_SESSION_LIFECYCLE_FEATURE) || this.stopped) {
      return
    }
    await this.heal(rows.filter((row) => !hasBuildWebSession(row)))
    const present = await this.withoutGoneWorktrees(rows.filter(hasBuildWebSession))
    if (present.length === 0 || this.stopped) {
      return
    }
    const lookup = await fetchBuildWebAgentSessions(
      present.map((row) => row.task.sessionId),
      { background: true }
    )
    const byId = new Map(lookup.sessions.map((session) => [session.id, session]))
    const autoCleanup = lookup.settings.auto_cleanup
    const eligible: [BuildWebLinkedTaskWorktree, BuildWebAgentSessionStatus][] = []
    for (const row of present) {
      const status = byId.get(row.task.sessionId)
      if (status && !this.stopped) {
        await this.mirrorState(row, status, autoCleanup)
        if (status.eligible && autoCleanup) {
          eligible.push([row, status])
        }
      }
    }
    if (eligible.length === 0 || this.stopped) {
      return
    }
    const ps = await this.deps.runtime
      .getWorktreePs(BUILD_WEB_WORKTREE_PS_LIMIT)
      .catch(() => undefined)
    for (const [row, status] of eligible) {
      // Why not awaited: a slow Git scan or a hung delete must not stall the next tick; the
      // finisher runs one look per worktree at a time.
      void this.finisher.finish(row, status, ps)
    }
  }

  private async heal(rows: BuildWebTaskWorktree[]): Promise<void> {
    const now = Date.now()
    for (const row of rows) {
      if (this.stopped) {
        return
      }
      const triedAt = this.healTriedAt.get(row.worktreeId)
      if (now - (triedAt ?? 0) < HEAL_RETRY_MS) {
        continue
      }
      this.healTriedAt.set(row.worktreeId, now)
      const linked = await healBuildWebSessionLink(
        this.deps.runtime,
        row,
        readIssueInBackground
      ).catch(() => false)
      // Why the second miss: the first may race the launch that is still recording the session.
      if (!linked && triedAt !== undefined && !this.unlinkedNoted.has(row.worktreeId)) {
        this.unlinkedNoted.add(row.worktreeId)
        console.warn(
          `[build-web] ${row.task.key}: no console session names this worktree's tabs; it is not cleaned up`
        )
      }
    }
  }

  private async withoutGoneWorktrees(
    rows: BuildWebLinkedTaskWorktree[]
  ): Promise<BuildWebLinkedTaskWorktree[]> {
    const present: BuildWebLinkedTaskWorktree[] = []
    for (const sessionId of this.goneLooks.keys()) {
      if (!rows.some((row) => row.task.sessionId === sessionId)) {
        this.goneLooks.delete(sessionId)
      }
    }
    for (const row of rows) {
      const { sessionId } = row.task
      // Why skipped: a delete through Orca or the finisher is not a removal behind Orca's back.
      if (
        this.goneTried.has(sessionId) ||
        this.finisher.isWorking(row.worktreeId) ||
        isBuildWebTaskWorktreeBeingRemoved(this.deps.runtime, row.worktreeId)
      ) {
        this.goneLooks.delete(sessionId)
        continue
      }
      if (!(await isBuildWebTaskWorktreeGone(this.deps.store, row)) || this.stopped) {
        this.goneLooks.delete(sessionId)
        present.push(row)
        continue
      }
      const looks = (this.goneLooks.get(sessionId) ?? 0) + 1
      this.goneLooks.set(sessionId, looks)
      if (looks < GONE_LOOKS) {
        continue
      }
      this.goneLooks.delete(sessionId)
      // Why marked before it ends: one try per run; a step aside is looked at again next tick.
      this.goneTried.add(sessionId)
      void this.finisher.finishGone(row).then((outcome) => {
        if (outcome === 'cancelled') {
          this.goneTried.delete(sessionId)
        }
      })
    }
    return present
  }

  private async mirrorState(
    row: BuildWebLinkedTaskWorktree,
    status: BuildWebAgentSessionStatus,
    autoCleanup: boolean
  ): Promise<void> {
    // Why fresh: a Keep or the finisher may have written since the tick listed the worktree.
    const meta = readWorktreeMetaForHost(this.deps.store, row.worktreeId, LOCAL_EXECUTION_HOST_ID)
    if (meta?.buildWebTask?.sessionId !== row.task.sessionId) {
      return
    }
    const change = watchedBuildWebSessionChange(meta.buildWebSession, status, autoCleanup)
    if (change.kind === 'none') {
      return
    }
    const updates =
      change.kind === 'set'
        ? { buildWebSession: { ...change.session, at: Date.now() } }
        : change.kind === 'clear-session'
          ? { buildWebSession: null }
          : { buildWebTask: null, buildWebSession: null }
    await this.deps.runtime
      .updateManagedWorktreeMeta(`id:${row.worktreeId}`, updates)
      .catch((error) => console.warn('[build-web] could not record a session state:', error))
  }
}
