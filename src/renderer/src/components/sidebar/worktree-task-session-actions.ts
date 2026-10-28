import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { defaultScopeHost } from '@/lib/default-creation-host'
import { getProviderRuntimeContextKey } from '@/lib/provider-runtime-context'
import { runtimeTargetForWorkspaceOwner } from '@/lib/resolve-owner'
import { ipcOrRuntimeTargetForHostId } from '@/runtime/runtime-client-target'
import type { RuntimeClientTarget } from '../../../../shared/runtime-client-target'
import { sameBuildWebConsole } from '../../../../shared/build-web-console-origin'
import type { Worktree } from '../../../../shared/worktree/types'
import { callBuildWeb } from '../build-web/build-web-client'
import { useBuildWebStore } from '../build-web/build-web-store'
import { showBuildWebTaskCard } from '../build-web/open-task-by-key'

// IS-147: what a task worktree's row does with its task — open its card, keep the worktree
// (unlinking it), or reopen the task. Keep and reopen run on the host that owns the worktree.

function ownerTarget(worktree: Pick<Worktree, 'id' | 'hostId'>): RuntimeClientTarget | null {
  return worktree.hostId
    ? ipcOrRuntimeTargetForHostId(worktree.hostId)
    : runtimeTargetForWorkspaceOwner(useAppStore.getState(), { workspaceId: worktree.id })
}

/** The task's card, only when this client's console is the one the task lives on. */
export async function openWorktreeBuildWebTask(worktree: Worktree): Promise<void> {
  const task = worktree.buildWebTask
  if (!task) {
    return
  }
  const host = {
    activeRuntimeEnvironmentId: useAppStore.getState().settings?.activeRuntimeEnvironmentId ?? null
  }
  const contextKey = getProviderRuntimeContextKey(host)
  const store = useBuildWebStore.getState()
  const status =
    store.contextKey === contextKey && store.status
      ? store.status
      : await callBuildWeb(defaultScopeHost(host), 'status').catch(() => null)
  if (!status?.connected || !sameBuildWebConsole(status.baseUrl, task.consoleHost)) {
    toast.error(
      translate(
        'buildWeb.session.openTask.otherConsole',
        '{{key}} lives on another console: {{console}}.',
        { key: task.key, console: task.consoleHost }
      )
    )
    return
  }
  // Why: the first status of a host clears the open card, so it must land before the card opens.
  if (store.contextKey !== contextKey) {
    store.setStatus(contextKey, status)
  }
  showBuildWebTaskCard({ id: task.issueId, key: task.key, title: worktree.displayName || task.key })
}

async function runOnOwner(
  worktree: Worktree,
  run: (target: RuntimeClientTarget) => Promise<{ ok: true } | { ok: false; error: string }>,
  done: string
): Promise<void> {
  const target = ownerTarget(worktree)
  const result = target
    ? await run(target).catch((error: unknown) => ({
        ok: false as const,
        error: error instanceof Error ? error.message : String(error)
      }))
    : {
        ok: false as const,
        error: translate('buildWeb.session.hostUnknown', 'The host of this workspace is unknown.')
      }
  if (result.ok) {
    toast.success(done)
  } else {
    toast.error(result.error)
  }
}

/** «Keep»: the host unlinks the worktree from its task; the worktree stays as it is. */
export function keepWorktreeTaskSession(worktree: Worktree): Promise<void> {
  const key = worktree.buildWebTask?.key ?? ''
  return runOnOwner(
    worktree,
    (target) => callBuildWeb(target, 'keepWorktreeSession', { worktreeId: worktree.id }),
    translate('buildWeb.session.kept', '{{name}} kept, unlinked from {{key}}', {
      name: worktree.displayName,
      key
    })
  )
}

/** «Back to work»: reopens the task in the console, which takes the session out of closing. */
export function reopenWorktreeTask(worktree: Worktree): Promise<void> {
  const task = worktree.buildWebTask
  if (!task) {
    return Promise.resolve()
  }
  return runOnOwner(
    worktree,
    (target) =>
      callBuildWeb(target, 'updateIssue', { id: task.issueId, patch: { status: 'inprogress' } }),
    translate('buildWeb.session.reopened', '{{key}} is back in progress', { key: task.key })
  )
}
