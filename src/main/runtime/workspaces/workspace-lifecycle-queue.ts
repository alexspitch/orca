import { ProducerRevision } from '../sidebar-inputs/producer-revision'
import type { WorkspaceLifecycleHint } from '../../../shared/sidebar-list/workspace-lifecycle-hints'
import type { WorkspaceCreationsSnapshot } from '../../../shared/sidebar-list/workspace-creations'
import {
  UNQUEUED_RUN,
  WORKSPACE_DELETED_ERROR,
  attemptLifecycleCommand,
  type LifecycleAttempt,
  type LifecycleCommand,
  type LifecycleMembership
} from './workspace-lifecycle-command'
import {
  WorkspaceLifecycleCreations,
  type WorkspaceCreationHandle
} from './workspace-lifecycle-creations'
import {
  cancelQueued,
  isFinalDelete,
  settleBehindDelete,
  workspaceQueueHint,
  type LifecycleEntry,
  type LifecyclePause,
  type WorkspaceQueue
} from './workspace-lifecycle-entries'

type Signal = { promise: Promise<void>; notify: () => void }

const OBSERVE_RETRY_MS = 5_000
// Long enough for a lookup on a reachable host, so its command keeps its place in the order.
const LOOKUP_ORDER_WAIT_MS = 500

function signal(): Signal {
  let notify!: () => void
  const promise = new Promise<void>((resolve) => (notify = resolve))
  return { promise, notify }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms).unref?.())
}

/** Serialize commands per host/workspace without merging. Delete cancels queued work and awaits running work (a tentative delete cancels nothing: what arrives waits behind it); unconfirmed outcomes pause until owner observation, never replay. Pending state is lost on restart. */
export class WorkspaceLifecycleQueue {
  readonly revision = new ProducerRevision()
  private readonly queues = new Map<string, WorkspaceQueue>()
  private membership: LifecycleMembership = (done) => done()
  private nextSeq = 0
  /** Bound waits for earlier unresolved lookups so one dead host cannot stall every workspace. */
  private readonly resolving = new Map<number, number>()
  private resolved: Signal = signal()
  private readonly creations = new WorkspaceLifecycleCreations<LifecycleEntry>({
    revision: this.revision,
    membership: () => this.membership,
    deletePending: (key) => this.deletePending(key),
    bind: (key) => this.bindCreate(key),
    finish: (key, entry) => this.finishEntry(key, entry)
  })

  constructor(
    private readonly retryDelay: (ms: number) => Promise<void> = sleep,
    private readonly now: () => number = Date.now
  ) {}

  private lookupWaitMs(seq: number): number {
    const waits = [...this.resolving].flatMap(([earlier, arrivedAt]) =>
      earlier < seq ? [arrivedAt + LOOKUP_ORDER_WAIT_MS - this.now()] : []
    )
    return Math.max(0, ...waits)
  }

  /** Where finished creates and deletes wait to be listed; until set they settle at once. */
  setMembership(membership: LifecycleMembership): void {
    this.membership = membership
  }

  submit<T>(key: string, command: LifecycleCommand<T>): Promise<T> {
    return this.enqueue(key, command, this.nextSeq++)
  }

  /** Reserve arrival order before lookup; null runs directly with no workspace to order. */
  async submitResolving<T>(
    resolveKey: () => Promise<string | null>,
    command: LifecycleCommand<T>
  ): Promise<T> {
    const seq = this.nextSeq++
    this.resolving.set(seq, this.now())
    let key: string | null
    try {
      key = await resolveKey()
    } finally {
      this.resolving.delete(seq)
      const resolved = this.resolved
      this.resolved = signal()
      resolved.notify()
    }
    return key === null ? command.run(UNQUEUED_RUN) : this.enqueue(key, command, seq)
  }

  openCreate(
    start: Parameters<WorkspaceLifecycleCreations<LifecycleEntry>['open']>[0]
  ): WorkspaceCreationHandle {
    return this.creations.open(start)
  }

  hints(): Record<string, WorkspaceLifecycleHint> {
    const hints: Record<string, WorkspaceLifecycleHint> = {}
    for (const [key, queue] of this.queues) {
      const hint = workspaceQueueHint(queue)
      if (hint) {
        hints[key] = hint
      }
    }
    for (const key of this.creations.settlingKeys()) {
      hints[key] ??= { kind: 'create', queuedBehind: 0 }
    }
    return hints
  }

  creationsSnapshot(): WorkspaceCreationsSnapshot {
    return this.creations.snapshot()
  }

  pausedKeys(): string[] {
    return [...this.queues].flatMap(([key, queue]) => (queue.paused ? [key] : []))
  }

  private enqueue<T>(key: string, command: LifecycleCommand<T>, seq: number): Promise<T> {
    const queue = this.queueFor(key)
    const tentative = command.delete?.tentative === true
    const pendingDelete = queue.entries.find(isFinalDelete)
    if (pendingDelete) {
      const pending = pendingDelete.command?.delete
      if (command.kind !== 'delete') {
        return Promise.reject(new Error(WORKSPACE_DELETED_ERROR))
      }
      // A tentative delete never joins: a person's delete is already on its way.
      if (!tentative && pendingDelete.reply && pending?.key === command.delete?.key) {
        // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: an equal delete shares the pending delete's reply, as a removal in flight always has.
        return pendingDelete.reply as Promise<T>
      }
      // A forced delete replaces an unforced one still waiting (behind a pause); never a running one.
      // A tentative one steps aside.
      if (tentative || !command.delete?.force || pendingDelete.state === 'running') {
        const label = command.delete?.label ?? key
        return Promise.reject(new Error(`Worktree deletion already in progress: ${label}`))
      }
    }
    if (command.kind === 'delete' && !tentative) {
      // A tentative delete ahead keeps its place, unless a forced delete must get past a pause.
      const force = command.delete?.force === true
      cancelQueued(queue, (entry) => force || !entry.tentative)
    }
    let settle!: (attempt: LifecycleAttempt) => void
    const reply = new Promise<unknown>((resolve, reject) => {
      settle = (result) => (result.threw ? reject(result.error) : resolve(result.value))
    })
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: widened only to be stored; run's result is handed back to this command's own caller.
    const stored = command as LifecycleCommand<unknown>
    const entry: LifecycleEntry = {
      kind: command.kind,
      seq,
      state: 'queued',
      command: stored,
      reply,
      settle,
      ...(tentative ? { tentative: { committed: false } } : {})
    }
    // Late lookup results retain arrival order among queued entries.
    const after = queue.entries.findIndex((queued) => queued.state === 'queued' && queued.seq > seq)
    queue.entries.splice(after === -1 ? queue.entries.length : after, 0, entry)
    this.revision.bump()
    if (command.delete?.force) {
      queue.wake?.()
    }
    void this.drain(key)
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: settled only with this command's run result.
    return reply as Promise<T>
  }

  private deletePending(key: string): boolean {
    return this.queues.get(key)?.entries.some((entry) => entry.kind === 'delete') === true
  }

  private queueFor(key: string): WorkspaceQueue {
    let queue = this.queues.get(key)
    if (!queue) {
      queue = { entries: [], paused: null, settling: 0, draining: false, wake: null }
      this.queues.set(key, queue)
    }
    return queue
  }

  private bindCreate(key: string): LifecycleEntry {
    const queue = this.queueFor(key)
    const entry: LifecycleEntry = {
      kind: 'create',
      seq: this.nextSeq++,
      state: 'running',
      command: null,
      reply: null,
      settle: () => {}
    }
    // This create already runs outside the queue, ahead of unstarted commands.
    const firstQueued = queue.entries.findIndex((queued) => queued.state === 'queued')
    queue.entries.splice(firstQueued === -1 ? queue.entries.length : firstQueued, 0, entry)
    return entry
  }

  private finishEntry(key: string, entry: LifecycleEntry): void {
    const queue = this.queues.get(key)
    const index = queue?.entries.indexOf(entry) ?? -1
    if (queue && index !== -1) {
      queue.entries.splice(index, 1)
      this.revision.bump()
      void this.drain(key)
    }
  }

  private async drain(key: string): Promise<void> {
    const queue = this.queues.get(key)
    if (!queue || queue.draining) {
      return
    }
    queue.draining = true
    try {
      for (let head = queue.entries[0]; head; head = queue.entries[0]) {
        if (head.state === 'running' || !head.command) {
          // A create running outside the queue; its close drains again.
          return
        }
        const waitMs = this.lookupWaitMs(head.seq)
        if (waitMs > 0) {
          await Promise.race([this.resolved.promise, this.retryDelay(waitMs)])
          continue
        }
        if (queue.paused && !head.command.delete?.force) {
          await this.awaitOwner(queue, queue.paused)
          continue
        }
        await this.runHead(key, queue, head, head.command)
      }
    } finally {
      queue.draining = false
      this.forgetIfIdle(key, queue)
    }
  }

  private async runHead(
    key: string,
    queue: WorkspaceQueue,
    head: LifecycleEntry,
    command: LifecycleCommand<unknown>
  ): Promise<void> {
    head.state = 'running'
    this.revision.bump()
    const result = await attemptLifecycleCommand(command, {
      committed: () => {
        if (head.tentative && !head.tentative.committed) {
          head.tentative.committed = true
          this.revision.bump()
        }
      }
    })
    queue.entries.splice(queue.entries.indexOf(head), 1)
    if (result.outcome === 'unverifiable') {
      queue.paused = { kind: head.kind, observe: command.observe ?? null }
    } else if (head.kind === 'delete' && !result.threw) {
      // Deleted: nothing is left to observe, and nothing waiting behind it has a workspace to act on.
      queue.paused = null
      settleBehindDelete(queue, result)
      queue.settling += 1
      this.membership(() => {
        queue.settling -= 1
        this.revision.bump()
        this.forgetIfIdle(key, queue)
      })
    }
    head.settle(result)
    this.revision.bump()
  }

  /** Wait for owner observation before lifting the pause; forced delete returns early, silent owners retry later. */
  private async awaitOwner(queue: WorkspaceQueue, paused: LifecyclePause): Promise<void> {
    if (!paused.observe) {
      queue.paused = null
      this.revision.bump()
      return
    }
    const woken = new Promise<'woken'>((resolve) => (queue.wake = () => resolve('woken')))
    try {
      const answered = await Promise.race([
        paused.observe().then(
          () => true,
          () => false
        ),
        woken
      ])
      if (answered === true) {
        await new Promise<void>((done) => this.membership(done))
        if (queue.paused === paused) {
          queue.paused = null
          this.revision.bump()
        }
      } else if (answered === false) {
        await Promise.race([this.retryDelay(OBSERVE_RETRY_MS), woken])
      }
    } finally {
      queue.wake = null
    }
  }

  private forgetIfIdle(key: string, queue: WorkspaceQueue): void {
    if (
      queue.entries.length === 0 &&
      !queue.paused &&
      queue.settling === 0 &&
      !queue.draining &&
      this.queues.get(key) === queue
    ) {
      this.queues.delete(key)
    }
  }
}
