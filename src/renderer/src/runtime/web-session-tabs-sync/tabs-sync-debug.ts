// TEMP DEBUG (remote workspace status not shown until selected): remove after the diagnosis.
import type { RuntimeMobileSessionTabsResult } from '../../../../shared/runtime-types'

const lastByTopic = new Map<string, string>()

/** One console line per event; `dedupeKey` drops repeats of an unchanged message. */
export function tabsSyncDebug(topic: string, data: unknown, dedupeKey?: string): void {
  const text = JSON.stringify(data)
  if (dedupeKey !== undefined) {
    const key = `${topic}\u0000${dedupeKey}`
    if (lastByTopic.get(key) === text) {
      return
    }
    lastByTopic.set(key, text)
  }
  console.info(`[tabs-sync-debug] ${topic} ${text}`)
}

function shortWorktree(worktree: string | undefined): string {
  return (worktree ?? '').split('/').slice(-2).join('/')
}

function agentStates(snapshot: Partial<RuntimeMobileSessionTabsResult>): string[] {
  return (snapshot.tabs ?? []).flatMap((tab) =>
    tab.type === 'terminal' && tab.agentStatus
      ? [`${String(tab.id).slice(0, 8)}=${tab.agentStatus.state}`]
      : []
  )
}

/** A compact view of a session.tabs frame: which worktree, version, epoch and agent states. */
export function describeSessionTabsFrame(frame: unknown): unknown {
  if (typeof frame !== 'object' || frame === null) {
    return frame
  }
  const value = frame as Record<string, unknown>
  if (value.type === 'snapshots' && Array.isArray(value.snapshots)) {
    return {
      type: 'snapshots',
      authoritative: value.authoritative,
      worktrees: (value.snapshots as RuntimeMobileSessionTabsResult[]).map((snapshot) => ({
        wt: shortWorktree(snapshot.worktree),
        v: snapshot.snapshotVersion,
        agents: agentStates(snapshot)
      }))
    }
  }
  const snapshot = value as Partial<RuntimeMobileSessionTabsResult> & {
    removed?: boolean
    tabsDelta?: unknown
  }
  return {
    type: value.type,
    wt: shortWorktree(snapshot.worktree),
    v: snapshot.snapshotVersion,
    ep: snapshot.publicationEpoch,
    ...(snapshot.removed ? { removed: true } : {}),
    ...(snapshot.tabsDelta ? { delta: true } : {}),
    agents: agentStates(snapshot)
  }
}

export { shortWorktree as tabsSyncDebugWorktree }
