import { toast } from 'sonner'
import { focusTerminalTabSurface } from '@/lib/focus-terminal-tab-surface'
import { launchAgentInNewTab } from '@/lib/launch-agent-in-new-tab'
import { newAgentLaunchRequestId } from '@/lib/agent-launch-request-id'
import { adoptAgentSessionLaunchVerdict } from '@/lib/agent-session-launch-plan'
import { findStructuredAgentSessionTab } from '@/lib/agent-session/structured-agent-session-tab-activation'
import { activateAndRevealWorktree } from '@/lib/worktree-activation'
import { runtimeTargetForWorkspaceOwner } from '@/lib/resolve-owner'
import { ipcOrRuntimeTargetForHostId } from '@/runtime/runtime-client-target'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import type { BuildWebIssueRow } from '../../../../shared/build-web-types'
import { worktreeFolderName } from '../../../../shared/build-web-task-session-worktree'
import { recordedSessionHostId } from '../../../../shared/build-web-session-host'
import type { RuntimeClientTarget } from '../../../../shared/runtime-client-target'
import type { Worktree } from '../../../../shared/worktree/types'
import type { BuildWebSessionArgs } from '../../../../preload/api/build-web-api'
import { callBuildWeb } from './build-web-client'
import { takeToWorkPrompt, type TakeToWorkFlags } from './build-web-take-to-work'
import { claudeNameArgs, taskSessionName } from './build-web-task-session'
import { resolveTuiAgentLaunchArgs } from '../../../../shared/tui-agent-launch-defaults'

// Plain module code, not a component effect: revealing the worktree leaves the Issues page.

const PROVIDER_SESSION_WAIT_MS = 10 * 60_000
/** Consoles that predate the session route; Orca then stops trying for that address. */
const sessionUnsupported = new Set<string>()

/**
 * Records the session on the task: the console's row id, `null` when the console names none or the
 * write failed, `false` for a console without the session route.
 */
async function writeSession(
  target: RuntimeClientTarget,
  baseUrl: string,
  issue: BuildWebIssueRow,
  session: BuildWebSessionArgs,
  worktreeId: string
): Promise<string | null | false> {
  if (sessionUnsupported.has(baseUrl)) {
    return false
  }
  // Why the worktree: its host then records the console's session row on it (IS-147).
  const result = await callBuildWeb(target, 'setAgentSession', {
    id: issue.id,
    session,
    worktreeId
  }).catch(() => null)
  // Why: only a missing route — a deleted task answers 404 too, with the console's own error.
  if (result && !result.ok && result.routeMissing) {
    sessionUnsupported.add(baseUrl)
    return false
  }
  if (!result?.ok) {
    toast.error(
      translate('buildWeb.launch.sessionNotSaved', 'Session ID not saved to {{keys}}', {
        keys: issue.key
      })
    )
    return null
  }
  return typeof result.value === 'string' ? result.value : null
}

/** The host that owns the worktree; null when its rows name none. */
function worktreeOwnerTarget(worktree: Worktree): RuntimeClientTarget | null {
  return worktree.hostId
    ? ipcOrRuntimeTargetForHostId(worktree.hostId)
    : runtimeTargetForWorkspaceOwner(useAppStore.getState(), { workspaceId: worktree.id })
}

const sameTarget = (a: RuntimeClientTarget, b: RuntimeClientTarget): boolean =>
  a.kind === 'local'
    ? b.kind === 'local'
    : b.kind === 'environment' && a.environmentId === b.environmentId

/** Whether the worktree runs on the host holding build-web's token, which names itself `local`. */
function onBuildWebHost(target: RuntimeClientTarget, worktree: Worktree): boolean {
  const owner = worktreeOwnerTarget(worktree)
  return owner !== null && sameTarget(owner, target)
}

/**
 * The build-web host links the session only to a worktree of its own; a worktree on another host
 * is linked by that host, which refuses one not made for the task. An older host lacks the call;
 * its watcher heals the link only where it holds a build-web token.
 */
function linkOnWorktreeHost(
  target: RuntimeClientTarget,
  worktree: Worktree,
  issue: BuildWebIssueRow,
  sessionId: string
): void {
  const owner = worktreeOwnerTarget(worktree)
  if (!owner || sameTarget(owner, target)) {
    return
  }
  void callBuildWeb(owner, 'linkWorktreeSession', {
    worktreeId: worktree.id,
    issueId: issue.id,
    sessionId
  }).catch(() => {})
}

/** Once the hook server learns Claude's own session id for this tab, record it on the task. */
function noteProviderSessionLater(
  target: RuntimeClientTarget,
  issue: BuildWebIssueRow,
  tabId: string
): void {
  let done = false
  const finish = () => {
    done = true
    unsubscribe()
    window.clearTimeout(timer)
  }
  const check = (state: ReturnType<typeof useAppStore.getState>) => {
    if (done) {
      return
    }
    const entry = Object.entries(state.agentStatusByPaneKey).find(
      ([paneKey, status]) => paneKey.startsWith(`${tabId}:`) && status?.providerSession?.id
    )
    const providerSessionId = entry?.[1]?.providerSession?.id
    if (!providerSessionId) {
      return
    }
    finish()
    void callBuildWeb(target, 'noteProviderSession', {
      id: issue.id,
      surfaceId: tabId,
      providerSessionId
    }).catch(() => {})
  }
  const unsubscribe = useAppStore.subscribe(check)
  const timer = window.setTimeout(finish, PROVIDER_SESSION_WAIT_MS)
  check(useAppStore.getState())
}

/** The console keeps a task worktree's folder name, never its label (the task's title). */
function sessionWorktreeName(worktree: Worktree): string {
  return (worktree.buildWebTask ? worktreeFolderName(worktree.path) : '') || worktree.displayName
}

/** A chat takes no launch label, so its tab is renamed once it exists. */
function nameStructuredTab(worktreeId: string, sessionId: string, name: string): void {
  const state = useAppStore.getState()
  const tab = findStructuredAgentSessionTab(state.unifiedTabsByWorktree, {
    workspaceId: worktreeId,
    sessionId
  })
  if (tab) {
    state.setTabCustomTitle(tab.id, name, { recordInteraction: false })
  }
}

export async function launchBuildWebTask(args: {
  target: RuntimeClientTarget
  baseUrl: string
  worktree: Worktree
  issue: BuildWebIssueRow
  flags: TakeToWorkFlags
  /** Another Claude account of the worktree's host than its selection; absent runs the selection. */
  claudeAccountId?: string
}): Promise<boolean> {
  const { target, baseUrl, worktree, issue, flags, claudeAccountId } = args
  const prompt = takeToWorkPrompt(issue.key, flags)
  const sessionName = taskSessionName([issue])
  // Why the defaults too: launch arguments replace the user's own Claude arguments, not add to them.
  const agentArgs = claudeNameArgs(
    resolveTuiAgentLaunchArgs('claude', useAppStore.getState().settings),
    sessionName
  )
  let revealFailed = false
  const result = launchAgentInNewTab({
    // Why a decided terminal route with an account: only a pane's spawn env carries it to its host.
    ...(claudeAccountId
      ? {
          agentSessionLaunchPlan: adoptAgentSessionLaunchVerdict({
            route: 'terminal-tui',
            requestId: newAgentLaunchRequestId(),
            agent: 'claude',
            worktreeId: worktree.id
          }),
          claudeAccountId
        }
      : { requestId: newAgentLaunchRequestId() }),
    agent: 'claude',
    worktreeId: worktree.id,
    groupId: worktree.id,
    prompt,
    agentArgs,
    promptDelivery: 'submit-after-ready',
    launchSource: 'build_web_page',
    quickCommandLabel: sessionName,
    beforeSurfaceOpen: () => {
      // Why: the launcher owns the initial surface, so revealing must not seed a sibling shell.
      revealFailed =
        activateAndRevealWorktree(worktree.id, {
          providesInitialSurface: true,
          ...(worktree.hostId ? { executionHostId: worktree.hostId } : {})
        }) === false
      return !revealFailed
    }
  })
  if (!result) {
    toast.error(
      revealFailed
        ? translate('buildWeb.launch.revealFailed', 'Could not open the worktree.')
        : translate('buildWeb.launch.failed', 'Could not start the agent.')
    )
    return false
  }
  const startedAt = new Date().toISOString()
  let surface: Pick<BuildWebSessionArgs, 'surface_kind' | 'surface_id'> = {
    surface_kind: 'unknown',
    surface_id: ''
  }
  if (result.surface.kind === 'local-terminal') {
    focusTerminalTabSurface(result.surface.tabId)
    surface = { surface_kind: 'terminal', surface_id: result.surface.tabId }
  } else if (result.structuredSettlement) {
    const settled = await result.structuredSettlement.catch(() => null)
    if (settled && (settled.kind === 'structured' || settled.kind === 'visibility-unknown')) {
      surface = { surface_kind: 'structured', surface_id: settled.sessionId }
      nameStructuredTab(worktree.id, settled.sessionId, sessionName)
    } else if (!settled || settled.kind === 'cancelled' || settled.kind === 'failed') {
      if (settled?.kind === 'failed' && !settled.notified) {
        toast.error(translate('buildWeb.launch.failed', 'Could not start the agent.'))
      }
      return false
    }
  }
  // Why: with no surface id (the host opened its own terminal) a record could never be cleared.
  if (!surface.surface_id) {
    return true
  }
  const written = await writeSession(
    target,
    baseUrl,
    issue,
    {
      ...surface,
      worktree_name: sessionWorktreeName(worktree),
      execution_host_id: recordedSessionHostId(worktree.hostId, onBuildWebHost(target, worktree)),
      agent: 'claude',
      started_at: startedAt
    },
    worktree.id
  )
  if (written === false) {
    return true
  }
  if (written) {
    linkOnWorktreeHost(target, worktree, issue, written)
  }
  const delivery = result.promptDeliveryResult
    ? await result.promptDeliveryResult.catch(() => null)
    : null
  if (delivery && !delivery.delivered && surface.surface_id) {
    // Why abandon: the session never got the task, so its history row says it never started.
    await callBuildWeb(target, 'clearAgentSession', {
      id: issue.id,
      surfaceId: surface.surface_id,
      abandon: true
    }).catch(() => {})
    return false
  }
  if (surface.surface_kind === 'terminal') {
    noteProviderSessionLater(target, issue, surface.surface_id)
  }
  return true
}
