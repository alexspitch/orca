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
import { buildWebBatchPrompt, type TakeToWorkFlags } from './build-web-take-to-work'

const WRITE_CONCURRENCY = 4
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

async function eachLimited<T>(items: T[], run: (item: T) => Promise<void>): Promise<void> {
  const queue = [...items]
  await Promise.all(
    Array.from({ length: Math.min(WRITE_CONCURRENCY, queue.length) }, async () => {
      for (let item = queue.shift(); item; item = queue.shift()) {
        await run(item)
      }
    })
  )
}

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

/** Records the session on every task; returns the keys it could not be saved to. */
async function writeSessions(
  call: BuildWebScreen['call'],
  baseUrl: string,
  issues: BuildWebIssueRow[],
  session: BuildWebSessionArgs
): Promise<string[]> {
  if (sessionUnsupported.has(baseUrl)) {
    return []
  }
  const failed: string[] = []
  await eachLimited(issues, async (issue) => {
    const result = await call('setAgentSession', { id: issue.id, session }).catch(() => null)
    // Why: only a missing route — a deleted task answers 404 too, with the console's own error.
    if (result && !result.ok && result.routeMissing) {
      sessionUnsupported.add(baseUrl)
    } else if (!result?.ok) {
      failed.push(issue.key)
    }
  })
  return sessionUnsupported.has(baseUrl) ? [] : failed
}

/** The host starts Claude in the worktree with only the skill call; the tasks then name the session. */
export async function launchBuildWebBatch(args: {
  client: RpcClient
  hostCapabilities: readonly string[]
  call: BuildWebScreen['call']
  baseUrl: string
  worktree: { worktreeId: string; displayName: string; hostId?: string }
  issues: BuildWebIssueRow[]
  flags: TakeToWorkFlags
  /** Another Claude account of the host than its selection; absent runs the selection. */
  claudeAccountId?: string
  /** The host's own Claude arguments, read off its settings; the session's name is added to them. */
  hostClaudeArgs?: string | null
}): Promise<BuildWebBatchLaunch> {
  const { worktree, issues } = args
  const prompt = buildWebBatchPrompt(
    issues.map((i) => i.key),
    args.flags
  )
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
      ? { agentArgs: claudeNameArgs(args.hostClaudeArgs, taskSessionName(issues)) }
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
  // Why no record without delivery: the session never got the tasks, so they must not point at it.
  // Why none without a surface id either: such a record could never be cleared.
  if (launched.promptDelivered && surface.surface_id) {
    const failed = await writeSessions(args.call, args.baseUrl, issues, {
      ...surface,
      worktree_name: worktree.displayName,
      execution_host_id: worktree.hostId ?? '',
      agent: 'claude',
      started_at: startedAt
    })
    if (failed.length) {
      warnings.push(`Session ID not saved to ${failed.join(', ')}`)
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
