import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { ensureHooksConfirmed } from '@/lib/ensure-hooks-confirmed'
import {
  resolveDirectLaunchOwnerRow,
  resolveDirectSetupDecision
} from '@/lib/launch-work-item-direct-preflight'
import type { Worktree } from '../../../../shared/worktree/types'

// «Take to work» in a new worktree: made the way a task's «Start work» makes one — the repo's
// setup policy and hook trust decide the setup script — before the session opens in it.

export async function createBatchWorktree(args: {
  repoId: string
  name: string
  /** Empty: the repository's default base. */
  baseBranch: string
}): Promise<Worktree | null> {
  const store = useAppStore.getState()
  const owner = resolveDirectLaunchOwnerRow(store.repos, args.repoId)
  if (!owner) {
    toast.error(translate('buildWeb.take.noRepoFound', 'The repository is not available.'))
    return null
  }
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
        args.baseBranch.trim() || undefined,
        trust === 'skip' ? 'skip' : decision,
        undefined,
        'unknown',
        args.name,
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
        { executionHostId: owner.executionHostId }
      )
    return result.worktree
  } catch (failure) {
    toast.error(
      translate('buildWeb.take.createFailed', 'Could not create the worktree: {{error}}', {
        error: failure instanceof Error ? failure.message : String(failure)
      })
    )
    return null
  }
}
