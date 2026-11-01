import type { AgentRowState } from './agent-row-decay-state'

/** The agent's turn still runs: it works or waits for permission to go on. */
export function agentStateIsActive(state: AgentRowState): boolean {
  return state === 'working' || state === 'blocked' || state === 'waiting'
}

/** Every agent under a session at any depth: its subagents and the agents it dispatched. */
export function agentsUnderSession<T extends { paneKey: string }>(
  sessionPaneKey: string,
  childrenByParentPaneKey: ReadonlyMap<string, readonly T[]>
): T[] {
  const seen = new Set([sessionPaneKey])
  const pending = [...(childrenByParentPaneKey.get(sessionPaneKey) ?? [])]
  const out: T[] = []
  for (let agent = pending.pop(); agent; agent = pending.pop()) {
    if (seen.has(agent.paneKey)) {
      continue
    }
    seen.add(agent.paneKey)
    out.push(agent)
    pending.push(...(childrenByParentPaneKey.get(agent.paneKey) ?? []))
  }
  return out
}

/**
 * A workspace's live agent sessions (lineage roots), and how many of them run a turn themselves or
 * through an agent under them.
 */
export function countAgentSessions<T extends { paneKey: string; state: AgentRowState }>(
  rootRows: readonly T[],
  childrenByParentPaneKey: ReadonlyMap<string, readonly T[]>,
  isLive: (row: T) => boolean
): { active: number; total: number } {
  let active = 0
  let total = 0
  for (const session of rootRows) {
    if (!isLive(session)) {
      continue
    }
    total += 1
    if (
      agentStateIsActive(session.state) ||
      agentsUnderSession(session.paneKey, childrenByParentPaneKey).some(
        (agent) => isLive(agent) && agentStateIsActive(agent.state)
      )
    ) {
      active += 1
    }
  }
  return { active, total }
}
