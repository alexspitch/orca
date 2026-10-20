import { useAppStore } from '@/store'
import { getConnectionId } from '@/lib/connection-context'
import { getRuntimeTargetForFileOwner } from '@/lib/file-owner-runtime-target'
import { findWorktreeById } from '@/store/slices/worktree-helpers'
import type { RuntimeGitContext } from '@/runtime/runtime-git-client-context'

export type OpenFileGitContext = RuntimeGitContext & {
  worktreeId: string
  runtimeEnvironmentId: string | null | undefined
}

/** Where git runs for an open file: its worktree on the host that owns it; null once it is gone. */
export function resolveOpenFileGitContext(filePath: string): OpenFileGitContext | null {
  const state = useAppStore.getState()
  const file = state.openFiles.find((f) => f.filePath === filePath)
  if (!file) {
    return null
  }
  const worktree = findWorktreeById(state.worktreesByRepo, file.worktreeId)
  const target = getRuntimeTargetForFileOwner(state, file.worktreeId, file.runtimeEnvironmentId)
  if (!worktree || !target) {
    return null
  }
  return {
    target,
    worktreeId: file.worktreeId,
    worktreePath: worktree.path,
    connectionId: getConnectionId(file.worktreeId) ?? undefined,
    runtimeEnvironmentId: file.runtimeEnvironmentId
  }
}
