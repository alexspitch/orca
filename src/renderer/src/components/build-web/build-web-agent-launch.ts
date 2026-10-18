import { toast } from 'sonner'
import { focusTerminalTabSurface } from '@/lib/focus-terminal-tab-surface'
import { launchAgentInNewTab } from '@/lib/launch-agent-in-new-tab'
import { newAgentLaunchRequestId } from '@/lib/agent-launch-request-id'
import { findStructuredAgentSessionTab } from '@/lib/structured-agent-session-tab-activation'
import { activateAndRevealWorktree } from '@/lib/worktree-activation'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import type { BuildWebIssueRow } from '../../../../shared/build-web-types'
import type { RuntimeClientTarget } from '../../../../shared/runtime-client-target'
import type { Worktree } from '../../../../shared/worktree/types'
import type { BuildWebSessionArgs } from '../../../../preload/api/build-web-api'
import { callBuildWeb } from './build-web-client'
import { buildWebBatchPrompt, type TakeToWorkFlags } from './build-web-take-to-work'
import { taskSessionName } from './build-web-task-session'

// Plain module code, not a component effect: revealing the worktree leaves the Issues page.

const PROVIDER_SESSION_WAIT_MS = 10 * 60_000
const WRITE_CONCURRENCY = 4
/** Consoles that predate the session route; Orca then stops trying for that address. */
const sessionUnsupported = new Set<string>()

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

async function writeSessions(
  target: RuntimeClientTarget,
  baseUrl: string,
  issues: BuildWebIssueRow[],
  session: BuildWebSessionArgs
): Promise<boolean> {
  if (sessionUnsupported.has(baseUrl)) {
    return false
  }
  const failed: string[] = []
  await eachLimited(issues, async (issue) => {
    const result = await callBuildWeb(target, 'setAgentSession', { id: issue.id, session }).catch(
      () => null
    )
    // Why: only a missing route — a deleted task answers 404 too, with the console's own error.
    if (result && !result.ok && result.routeMissing) {
      sessionUnsupported.add(baseUrl)
    } else if (!result?.ok) {
      failed.push(issue.key)
    }
  })
  if (failed.length && !sessionUnsupported.has(baseUrl)) {
    toast.error(
      translate('buildWeb.launch.sessionNotSaved', 'Session ID not saved to {{keys}}', {
        keys: failed.join(', ')
      })
    )
  }
  return !sessionUnsupported.has(baseUrl)
}

/** Once the hook server learns Claude's own session id for this tab, record it on the tasks. */
function noteProviderSessionLater(
  target: RuntimeClientTarget,
  issues: BuildWebIssueRow[],
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
    for (const issue of issues) {
      void callBuildWeb(target, 'noteProviderSession', {
        id: issue.id,
        surfaceId: tabId,
        providerSessionId
      }).catch(() => {})
    }
  }
  const unsubscribe = useAppStore.subscribe(check)
  const timer = window.setTimeout(finish, PROVIDER_SESSION_WAIT_MS)
  check(useAppStore.getState())
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

export async function launchBuildWebBatch(args: {
  target: RuntimeClientTarget
  baseUrl: string
  worktree: Worktree
  issues: BuildWebIssueRow[]
  flags: TakeToWorkFlags
}): Promise<boolean> {
  const { target, baseUrl, worktree, issues, flags } = args
  const keys = issues.map((i) => i.key)
  const prompt = buildWebBatchPrompt(keys, flags)
  const sessionName = taskSessionName(keys)
  let revealFailed = false
  const result = launchAgentInNewTab({
    requestId: newAgentLaunchRequestId(),
    agent: 'claude',
    worktreeId: worktree.id,
    groupId: worktree.id,
    prompt,
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
  const written = await writeSessions(target, baseUrl, issues, {
    ...surface,
    worktree_name: worktree.displayName,
    execution_host_id: worktree.hostId ?? '',
    agent: 'claude',
    started_at: startedAt
  })
  if (!written) {
    return true
  }
  const delivery = result.promptDeliveryResult
    ? await result.promptDeliveryResult.catch(() => null)
    : null
  if (delivery && !delivery.delivered && surface.surface_id) {
    await eachLimited(issues, async (issue) => {
      await callBuildWeb(target, 'clearAgentSession', {
        id: issue.id,
        surfaceId: surface.surface_id
      }).catch(() => {})
    })
    return false
  }
  if (surface.surface_kind === 'terminal') {
    noteProviderSessionLater(target, issues, surface.surface_id)
  }
  return true
}
