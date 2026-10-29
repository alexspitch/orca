import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { runtimeTargetForWorkspaceOwner } from '@/lib/resolve-owner'
import { ipcOrRuntimeTargetForHostId } from '@/runtime/runtime-client-target'
import type { RuntimeClientTarget } from '../../../../shared/runtime-client-target'
import type { Worktree } from '../../../../shared/worktree/types'
import { callBuildWeb } from '../build-web/build-web-client'
import { openBuildWebTaskCard } from '../build-web/open-task-by-key'

// IS-147: what a task worktree's row does with its task — open its card, keep the worktree
// (unlinking it), or reopen the task. Keep and reopen run on the host that owns the worktree.

function ownerTarget(worktree: Pick<Worktree, 'id' | 'hostId'>): RuntimeClientTarget | null {
  return worktree.hostId
    ? ipcOrRuntimeTargetForHostId(worktree.hostId)
    : runtimeTargetForWorkspaceOwner(useAppStore.getState(), { workspaceId: worktree.id })
}

function hostUnknown(): string {
  return translate('buildWeb.session.hostUnknown', 'The host of this workspace is unknown.')
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** The task's card as a tab of the current workspace, only when this client's console holds the task. */
export function openWorktreeBuildWebTask(worktree: Worktree): Promise<void> {
  const task = worktree.buildWebTask
  return task
    ? openBuildWebTaskCard({ ...task, title: worktree.displayName || task.key }, worktree.id)
    : Promise.resolve()
}

/** «Keep»: the host unlinks the worktree from its task; the worktree stays as it is. */
export async function keepWorktreeTaskSession(worktree: Worktree): Promise<void> {
  const target = ownerTarget(worktree)
  if (!target) {
    toast.error(hostUnknown())
    return
  }
  const result = await callBuildWeb(target, 'keepWorktreeSession', {
    worktreeId: worktree.id
  }).catch((error: unknown) => ({ ok: false as const, error: errorText(error) }))
  if (!result.ok) {
    toast.error(result.error)
    return
  }
  toast.success(
    translate('buildWeb.session.kept', '{{name}} kept, unlinked from {{key}}', {
      name: worktree.displayName,
      key: worktree.buildWebTask?.key ?? ''
    })
  )
}

/** The task's status once it is out of the archive or trash and patched back to in progress. */
async function moveTaskBackToWork(
  target: RuntimeClientTarget,
  issueId: string
): Promise<{ ok: true; status: string } | { ok: false; error: string }> {
  const detail = await callBuildWeb(target, 'getIssue', { id: issueId })
  if (detail.archived_at || detail.deleted_at) {
    const restored = await callBuildWeb(target, 'restoreIssue', { id: issueId })
    if (!restored.ok) {
      return restored
    }
  }
  const patched = await callBuildWeb(target, 'updateIssue', {
    id: issueId,
    patch: { status: 'inprogress' }
  })
  if (!patched.ok) {
    return patched
  }
  // Why the second read: the console may answer a patch without the task.
  const status =
    patched.value.issue?.status ?? (await callBuildWeb(target, 'getIssue', { id: issueId })).status
  return { ok: true, status }
}

/** «Back to work»: reopens the task in the console, which takes the session out of closing. */
export async function reopenWorktreeTask(worktree: Worktree): Promise<void> {
  const task = worktree.buildWebTask
  if (!task) {
    return
  }
  const target = ownerTarget(worktree)
  if (!target) {
    toast.error(hostUnknown())
    return
  }
  const result = await moveTaskBackToWork(target, task.issueId).catch((error: unknown) => ({
    ok: false as const,
    error: errorText(error)
  }))
  if (!result.ok) {
    toast.error(result.error)
  } else if (result.status !== 'inprogress') {
    toast.error(
      translate('buildWeb.session.reopenKept', 'The console kept {{key}} in {{status}}.', {
        key: task.key,
        status: result.status
      })
    )
  } else {
    toast.success(
      translate('buildWeb.session.reopened', '{{key}} is back in progress', { key: task.key })
    )
  }
}
