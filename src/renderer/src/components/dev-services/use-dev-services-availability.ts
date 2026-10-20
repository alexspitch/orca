import { useEffect, useMemo } from 'react'
import { useAppStore } from '@/store'
import { useRepoById } from '@/store/selectors'
import { getExecutionHostIdForWorktree } from '@/lib/worktree-runtime-owner'
import { useWorktreeRuntimeTarget } from '@/runtime/use-worktree-runtime-target'
import {
  DEV_SERVICES_AVAILABILITY_RECHECK_MS,
  devServicesRepoKey,
  refreshDevServicesAvailability,
  useDevServicesAvailabilityStore
} from '@/store/dev-services-availability'
import { isFolderRepo } from '../../../../shared/repo-kind'
import { parseWorkspaceKey } from '../../../../shared/workspace-scope'
import type { ExecutionHostId } from '../../../../shared/execution-host'
import type { RuntimeClientTarget } from '../../../../shared/runtime-client-target'

export type DevServicesAvailability = {
  worktreeId: string
  repoId: string
  hostId: ExecutionHostId
  target: RuntimeClientTarget
  /** orca.yaml's `services.command`, as the repo's host reported it. */
  command: string
}

/**
 * Whether a workspace has a Services panel: a git worktree whose repo's orca.yaml names a services
 * command, on a host that serves `devServices.*`. Direct-SSH workspaces have no runtime to ask.
 */
export function useDevServicesAvailability(
  worktreeId: string | null,
  enabled: boolean
): DevServicesAvailability | null {
  const worktreeRepoId = useAppStore((state) =>
    worktreeId && parseWorkspaceKey(worktreeId)?.type !== 'folder'
      ? (state.getKnownWorktreeById(worktreeId)?.repoId ?? null)
      : null
  )
  const repo = useRepoById(worktreeRepoId)
  const repoId = repo && !isFolderRepo(repo) ? repo.id : null
  const hostId = useAppStore((state) => getExecutionHostIdForWorktree(state, worktreeId))
  const target = useWorktreeRuntimeTarget(worktreeId)
  const key = repoId ? devServicesRepoKey(hostId, repoId) : null
  const entry = useDevServicesAvailabilityStore((state) => (key ? state.byRepoKey[key] : undefined))

  useEffect(() => {
    if (!enabled || !repoId || !target) {
      return
    }
    if (entry && Date.now() - entry.checkedAt < DEV_SERVICES_AVAILABILITY_RECHECK_MS) {
      return
    }
    void refreshDevServicesAvailability({ hostId, repoId, target })
  }, [enabled, entry, hostId, repoId, target])

  const command = entry?.command ?? null
  return useMemo(
    () =>
      worktreeId && repoId && target && command
        ? { worktreeId, repoId, hostId, target, command }
        : null,
    [command, hostId, repoId, target, worktreeId]
  )
}
