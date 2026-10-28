import type { BuildWebIssueRow } from '../../../../src/shared/build-web-types'
import type { BuildWebSessionArgs } from '../../../../src/preload/api/build-web-api'
import type { AgentLaunchOutcome } from '../../../../src/shared/agent-launch-intent'
import { parsePaneKey } from '../../../../src/shared/stable-pane-id'
import type { RpcClient } from '../../transport/rpc-client'
import { claudeNameArgs, taskSessionName } from '../../../../src/shared/build-web-task-session-name'
import { withClaudeLaunchAccount } from '../../../../src/shared/claude-launch-account'
import {
  AGENT_LAUNCH_UPDATE_REQUIRED_MESSAGE,
  launchAgentInExistingWorkspace
} from '../../session/mobile-existing-agent-launch'
import { AGENT_PROMPT_NOT_SENT_MESSAGE } from '../../session/pr-ai-triage-launch'
import type { BuildWebScreen } from '../build-web-screen-context'
import { takeToWorkPrompt, type TakeToWorkFlags } from './build-web-take-to-work'

/** Consoles that predate the session route; Orca then stops trying for that address. */
const sessionUnsupported = new Set<string>()

export type BuildWebBatchLaunch =
  | {
      kind: 'started'
      worktreeId: string
      /** The terminal pane the agent runs in, so opening the session lands on it. */
      paneKey?: string
      /** Set when the agent started but something around it did not: shown, not a failure. */
      warning?: string
    }
  | { kind: 'failed'; message: string }
  /** The agent may be running; do not launch again until the person has looked. */
  | { kind: 'unconfirmed'; message: string }

function surfaceOf(
  outcome: AgentLaunchOutcome
): Pick<BuildWebSessionArgs, 'surface_kind' | 'surface_id'> {
  if (outcome.kind === 'structured') {
    return { surface_kind: 'structured', surface_id: outcome.sessionId }
  }
  const tabId = outcome.paneKey ? parsePaneKey(outcome.paneKey)?.tabId : undefined
  return tabId
    ? { surface_kind: 'terminal', surface_id: tabId }
    : { surface_kind: 'unknown', surface_id: '' }
}

/** Records the session on the task; false when it could not be saved. */
async function writeSession(
  call: BuildWebScreen['call'],
  baseUrl: string,
  issue: BuildWebIssueRow,
  session: BuildWebSessionArgs,
  worktreeId: string
): Promise<boolean> {
  if (sessionUnsupported.has(baseUrl)) {
    return true
  }
  // Why the worktree: its host then records the console's session row on it (IS-147).
  const result = await call('setAgentSession', { id: issue.id, session, worktreeId }).catch(
    () => null
  )
  // Why: only a missing route — a deleted task answers 404 too, with the console's own error.
  if (result && !result.ok && result.routeMissing) {
    sessionUnsupported.add(baseUrl)
    return true
  }
  return result?.ok === true
}

/** The host starts Claude in the worktree with only the skill call; the task then names the session. */
export async function launchBuildWebTask(args: {
  client: RpcClient
  hostCapabilities: readonly string[]
  call: BuildWebScreen['call']
  baseUrl: string
  worktree: { worktreeId: string; displayName: string; hostId?: string }
  issue: BuildWebIssueRow
  flags: TakeToWorkFlags
  /** Another Claude account of the host than its selection; absent runs the selection. */
  claudeAccountId?: string
  /** The host's own Claude arguments, read off its settings; the session's name is added to them. */
  hostClaudeArgs?: string | null
}): Promise<BuildWebBatchLaunch> {
  const { worktree, issue } = args
  const prompt = takeToWorkPrompt(issue.key, args.flags)
  const startedAt = new Date().toISOString()
  const launched = await launchAgentInExistingWorkspace({
    client: args.client,
    hostCapabilities: args.hostCapabilities,
    worktreeId: worktree.worktreeId,
    agent: 'claude',
    prompt: { text: prompt, delivery: 'submit' },
    launchSource: 'build_web_page',
    // Why only with the host's own: launch arguments replace them rather than add to them.
    ...(args.hostClaudeArgs != null
      ? { agentArgs: claudeNameArgs(args.hostClaudeArgs, taskSessionName([issue])) }
      : {}),
    // Why a terminal: the host honors a launch's own account only on a terminal surface.
    ...(args.claudeAccountId
      ? {
          accountEnv: withClaudeLaunchAccount({}, 'claude', args.claudeAccountId),
          surface: 'terminal' as const
        }
      : {})
  })
  switch (launched.kind) {
    case 'unsupported':
      return { kind: 'failed', message: AGENT_LAUNCH_UPDATE_REQUIRED_MESSAGE }
    case 'failed':
    case 'tab-closed':
      return { kind: 'failed', message: launched.message }
    case 'unknown':
      return { kind: 'unconfirmed', message: launched.message }
    case 'launched':
      break
  }
  const { outcome } = launched.result
  const paneKey = outcome.kind === 'terminal' ? outcome.paneKey : undefined
  const warnings = [launched.result.warning?.trim()]
  const surface = surfaceOf(outcome)
  // Why no record without delivery: the session never got the task, so it must not point at it —
  // nor take it from a session that holds it. Nothing recorded means nothing to abandon either.
  // Why none without a surface id either: such a record could never be cleared.
  if (launched.promptDelivered && surface.surface_id) {
    const saved = await writeSession(
      args.call,
      args.baseUrl,
      issue,
      {
        ...surface,
        worktree_name: worktree.displayName,
        execution_host_id: worktree.hostId ?? '',
        agent: 'claude',
        started_at: startedAt
      },
      launched.result.worktreeId || worktree.worktreeId
    )
    if (!saved) {
      warnings.push(`Session ID not saved to ${issue.key}`)
    }
  }
  if (!launched.promptDelivered) {
    warnings.push(AGENT_PROMPT_NOT_SENT_MESSAGE)
  }
  const warning = warnings.filter(Boolean).join(' ')
  return {
    kind: 'started',
    worktreeId: launched.result.worktreeId || worktree.worktreeId,
    ...(paneKey ? { paneKey } : {}),
    ...(warning ? { warning } : {})
  }
}
