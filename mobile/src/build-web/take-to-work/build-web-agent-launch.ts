import type { BuildWebIssueRow } from '../../../../src/shared/build-web-types'
import type { BuildWebSessionArgs } from '../../../../src/preload/api/build-web-api'
import type { AgentLaunchOutcome } from '../../../../src/shared/agent-launch-intent'
import { parsePaneKey } from '../../../../src/shared/stable-pane-id'
import type { RpcClient } from '../../transport/rpc-client'
import { claudeNameArgs, taskSessionName } from '../../../../src/shared/build-web-task-session-name'
import { withClaudeLaunchAccount } from '../../../../src/shared/claude-launch-account'
import { AGENT_LAUNCH_SURFACE_RUNTIME_CAPABILITY } from '../../../../src/shared/agent-launch-runtime-capability'
import {
  AGENT_LAUNCH_UPDATE_REQUIRED_MESSAGE,
  launchAgentInExistingWorkspace,
  reserveMobileAgentLaunch
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

type SessionSurface = Pick<BuildWebSessionArgs, 'surface_kind' | 'surface_id'>

/** Records the session on the task: `unsupported` for a console without the session route. */
async function writeSession(
  call: BuildWebScreen['call'],
  baseUrl: string,
  issue: BuildWebIssueRow,
  session: BuildWebSessionArgs,
  worktreeId: string
): Promise<'saved' | 'failed' | 'unsupported'> {
  if (sessionUnsupported.has(baseUrl)) {
    return 'unsupported'
  }
  // Why the worktree: its host then records the console's session row on it (IS-147).
  const result = await call('setAgentSession', { id: issue.id, session, worktreeId }).catch(
    () => null
  )
  // Why: only a missing route — a deleted task answers 404 too, with the console's own error.
  if (result && !result.ok && result.routeMissing) {
    sessionUnsupported.add(baseUrl)
    return 'unsupported'
  }
  return result?.ok === true ? 'saved' : 'failed'
}

/** The session never got the task: its history row says it never started. */
function abandonSession(
  call: BuildWebScreen['call'],
  issue: BuildWebIssueRow,
  surface: SessionSurface
): Promise<unknown> {
  return call('clearAgentSession', {
    id: issue.id,
    surfaceId: surface.surface_id,
    abandon: true
  }).catch(() => null)
}

/**
 * The host starts Claude in the worktree with only the skill call; the task then names the session.
 * Like the desktop, the session is on the task before the prompt reaches the agent, so the skill's
 * first look at the task finds it; a launch that never delivered the prompt abandons it again. A
 * host that cannot be told to open a terminal in a reserved tab records it only after delivery.
 */
export async function launchBuildWebTask(args: {
  client: RpcClient
  hostCapabilities: readonly string[]
  call: BuildWebScreen['call']
  baseUrl: string
  worktree: { worktreeId: string; displayName: string; hostId?: string; folder?: string }
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
  const reservation = reserveMobileAgentLaunch('claude')
  // Why a terminal: its tab is reserved here, so the session can be recorded before the launch.
  const recordFirst = args.hostCapabilities.includes(AGENT_LAUNCH_SURFACE_RUNTIME_CAPABILITY)
  const terminal = recordFirst || Boolean(args.claudeAccountId)
  const record = (surface: SessionSurface, worktreeId: string) =>
    writeSession(
      args.call,
      args.baseUrl,
      issue,
      {
        ...surface,
        // The console keeps the folder; the label is the task's title.
        worktree_name: worktree.folder || worktree.displayName,
        execution_host_id: worktree.hostId ?? '',
        agent: 'claude',
        started_at: startedAt
      },
      worktreeId
    )
  let recorded: SessionSurface | null = null
  if (recordFirst) {
    const planned: SessionSurface = { surface_kind: 'terminal', surface_id: reservation.pane.tabId }
    recorded = (await record(planned, worktree.worktreeId)) === 'saved' ? planned : null
  }
  const launched = await launchAgentInExistingWorkspace({
    client: args.client,
    hostCapabilities: args.hostCapabilities,
    worktreeId: worktree.worktreeId,
    agent: 'claude',
    prompt: { text: prompt, delivery: 'submit' },
    launchSource: 'build_web_page',
    reservation,
    // Why only with the host's own: launch arguments replace them rather than add to them.
    ...(args.hostClaudeArgs != null
      ? { agentArgs: claudeNameArgs(args.hostClaudeArgs, taskSessionName([issue])) }
      : {}),
    // Why a terminal with an account too: the host honors a launch's own account only there.
    ...(args.claudeAccountId
      ? { accountEnv: withClaudeLaunchAccount({}, 'claude', args.claudeAccountId) }
      : {}),
    ...(terminal ? { surface: 'terminal' as const } : {})
  })
  if (launched.kind !== 'launched' && launched.kind !== 'unknown' && recorded) {
    await abandonSession(args.call, issue, recorded)
  }
  switch (launched.kind) {
    case 'unsupported':
      return { kind: 'failed', message: AGENT_LAUNCH_UPDATE_REQUIRED_MESSAGE }
    case 'failed':
    case 'tab-closed':
      return { kind: 'failed', message: launched.message }
    case 'unknown':
      // Why the record stays: the agent may be running in the reserved tab.
      return { kind: 'unconfirmed', message: launched.message }
    case 'launched':
      break
  }
  const { outcome } = launched.result
  const worktreeId = launched.result.worktreeId || worktree.worktreeId
  const paneKey = outcome.kind === 'terminal' ? outcome.paneKey : undefined
  const warnings = [launched.result.warning?.trim()]
  const surface = surfaceOf(outcome)
  // Why: a host that ignored the reservation opened another tab than the one recorded.
  if (recorded && recorded.surface_id !== surface.surface_id) {
    await abandonSession(args.call, issue, recorded)
    recorded = null
  }
  if (!launched.promptDelivered) {
    if (recorded) {
      await abandonSession(args.call, issue, recorded)
    }
    warnings.push(AGENT_PROMPT_NOT_SENT_MESSAGE)
  } else if (!recorded && surface.surface_id) {
    // Why none without a surface id: such a record could never be cleared.
    if ((await record(surface, worktreeId)) === 'failed') {
      warnings.push(`Session ID not saved to ${issue.key}`)
    }
  }
  const warning = warnings.filter(Boolean).join(' ')
  return {
    kind: 'started',
    worktreeId,
    ...(paneKey ? { paneKey } : {}),
    ...(warning ? { warning } : {})
  }
}
