import type { AgentStatusState } from './agent-status-types'
import type { NotificationEventSource, NotificationSettings } from './notification-settings-types'

/** A permission prompt (`blocked`) or a question (`waiting`): the agent cannot go on without the user. */
export function isAgentNeedsInputState(state: AgentStatusState | undefined): boolean {
  return state === 'blocked' || state === 'waiting'
}

/** False only for agent news the needs-input-only preference silences; a stateless completion is a finish. */
export function passesAgentNeedsInputOnly(
  settings: Pick<NotificationSettings, 'agentNeedsInputOnly'>,
  request: { source: NotificationEventSource; agentState?: AgentStatusState }
): boolean {
  return (
    request.source !== 'agent-task-complete' ||
    !settings.agentNeedsInputOnly ||
    isAgentNeedsInputState(request.agentState)
  )
}

/** The desktop preferences a notification must pass; the phone push follows the same answer. */
export function isNotificationSourceAllowed(
  settings: NotificationSettings,
  request: { source: NotificationEventSource; agentState?: AgentStatusState }
): boolean {
  return (
    settings.enabled &&
    (request.source !== 'agent-task-complete' || settings.agentTaskComplete) &&
    (request.source !== 'terminal-bell' || settings.terminalBell) &&
    (request.source !== 'build-web' || settings.buildWeb) &&
    passesAgentNeedsInputOnly(settings, request)
  )
}
