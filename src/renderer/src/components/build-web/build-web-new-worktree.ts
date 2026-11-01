import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { ensureHooksConfirmed } from '@/lib/ensure-hooks-confirmed'
import {
  resolveDirectLaunchOwnerRow,
  resolveDirectSetupDecision
} from '@/lib/launch-work-item-direct-preflight'
import { runtimeEnvironmentSupportsCapability } from '@/runtime/runtime-rpc-client'
import type { Worktree } from '../../../../shared/worktree/types'
import type { WorktreeBuildWebTaskRequest } from '../../../../shared/build-web-session-types'
import {
  BUILD_WEB_WORK_BRANCH_RUNTIME_CAPABILITY,
  BUILD_WEB_WORKTREE_TASK_RUNTIME_CAPABILITY
} from '../../../../shared/build-web-capability'
import type { RuntimeClientTarget } from '../../../../shared/runtime-client-target'

// «Take to work» in a new worktree: made the way a task's «Start work» makes one — the repo's
// setup policy and hook trust decide the setup script — before the session opens in it.

/** This window's own main has it; a server only from the version that announces it. */
async function hostSupports(target: RuntimeClientTarget, capability: string): Promise<boolean> {
  return target.kind === 'local'
    ? true
    : runtimeEnvironmentSupportsCapability(target.environmentId, capability).catch(() => false)
}

/** The task link as the host takes it: none for an older host, no `workBranch` for one before it. */
async function buildWebTaskForHost(
  task: WorktreeBuildWebTaskRequest | undefined,
  target: RuntimeClientTarget
): Promise<WorktreeBuildWebTaskRequest | null> {
  if (!task || !(await hostSupports(target, BUILD_WEB_WORKTREE_TASK_RUNTIME_CAPABILITY))) {
    return null
  }
  if (!task.workBranch || (await hostSupports(target, BUILD_WEB_WORK_BRANCH_RUNTIME_CAPABILITY))) {
    return task
  }
  const { workBranch: _unsupported, ...link } = task
  return link
}

/** The repo's host names a task worktree's branch after the console's `work_branch`. */
export function hostTakesWorkBranch(repoId: string): Promise<boolean> {
  const owner = resolveDirectLaunchOwnerRow(useAppStore.getState().repos, repoId)
  return owner
    ? hostSupports(owner.target, BUILD_WEB_WORK_BRANCH_RUNTIME_CAPABILITY)
    : Promise.resolve(false)
}

export async function createTaskWorktree(args: {
  repoId: string
  name: string
  /** Always named: the dialog fills in the repository's default and lets the person pick another. */
  baseBranch: string
  /** The task the worktree is made for; dropped for a host that would not keep it. */
  buildWebTask?: WorktreeBuildWebTaskRequest
  /** The sidebar label; the folder keeps `name`, the branch too unless the task names its own. */
  displayName?: string
}): Promise<Worktree | null> {
  const store = useAppStore.getState()
  const owner = resolveDirectLaunchOwnerRow(store.repos, args.repoId)
  if (!owner) {
    toast.error(translate('buildWeb.take.noRepoFound', 'The repository is not available.'))
    return null
  }
  const buildWebTask = await buildWebTaskForHost(args.buildWebTask, owner.target)
  const setup = await resolveDirectSetupDecision(args.repoId, owner.repo, owner.executionHostId)
  // Why `inherit` when the repo asks per workspace: there is no composer here to ask in.
  const decision = setup.kind === 'decided' ? setup.decision : 'inherit'
  const trust =
    decision === 'run'
      ? await ensureHooksConfirmed(
          () => useAppStore.getState(),
          args.repoId,
          'setup',
          owner.executionHostId
        )
      : 'run'
  try {
    const result = await useAppStore
      .getState()
      .createWorktree(
        args.repoId,
        args.name,
        args.baseBranch.trim(),
        trust === 'skip' ? 'skip' : decision,
        undefined,
        'unknown',
        args.displayName ?? args.name,
        undefined,
        undefined,
        undefined,
        'claude',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        { executionHostId: owner.executionHostId, ...(buildWebTask ? { buildWebTask } : {}) }
      )
    // Why the store's record: a paired server reports its own host as `local`, and revealing the new
    // worktree by that host finds nothing — the session never started.
    return (
      useAppStore.getState().getKnownWorktreeById(result.worktree.id, owner.executionHostId) ??
      result.worktree
    )
  } catch (failure) {
    toast.error(
      translate('buildWeb.take.createFailed', 'Could not create the worktree: {{error}}', {
        error: failure instanceof Error ? failure.message : String(failure)
      })
    )
    return null
  }
}
