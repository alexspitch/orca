import type { AgentStatusEntry } from '../../../../../shared/agent-status-types'
import '../../../../../shared/agent-status-types'
import { agentSubagentsEqual } from '../../../../../shared/agent-status-subagent-snapshot'
import { agentBackgroundCommandsEqual } from '../../../../../shared/agent-background-commands'
import { agentChildWorkViewsEqual } from '../../../../../shared/agent-status-child-work-view-wire'
import type { AgentStatusPayload } from './agent-status-contract'

/** Reuse equal child arrays for derived-row identity; children are host views, subagents the legacy roster. */
export function liveEntryChildFields(
  existing: AgentStatusEntry | undefined,
  payload: AgentStatusPayload
): Pick<AgentStatusEntry, 'subagents' | 'children' | 'backgroundCommands'> {
  return {
    subagents: agentSubagentsEqual(existing?.subagents, payload.subagents)
      ? existing?.subagents
      : payload.subagents,
    ...(payload.backgroundCommands
      ? {
          backgroundCommands: agentBackgroundCommandsEqual(
            existing?.backgroundCommands,
            payload.backgroundCommands
          )
            ? existing?.backgroundCommands
            : payload.backgroundCommands
        }
      : {}),
    ...(payload.children
      ? {
          children: agentChildWorkViewsEqual(existing?.children, payload.children)
            ? existing?.children
            : payload.children
        }
      : {})
  }
}
