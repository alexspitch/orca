import { useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '@/store'
import type { WorktreeStatus } from '@/lib/worktree-status'
import {
  selectWorktreeActivityStatuses,
  type WorktreeActivityStatusState
} from './worktree-activity-statuses'

// Why a separate module: the selector stays free of the store import, which sidebar filters reach.
export { selectWorktreeActivityStatuses }

// Keep equal status maps stable so unrelated terminal updates do not rerender the picker.
export function useWorktreeActivityStatuses(
  worktreeIds: readonly string[]
): Map<string, WorktreeStatus> {
  const selectStatuses = useCallback(
    (state: WorktreeActivityStatusState) => selectWorktreeActivityStatuses(state, worktreeIds),
    [worktreeIds]
  )
  return useAppStore(useShallow(selectStatuses))
}
