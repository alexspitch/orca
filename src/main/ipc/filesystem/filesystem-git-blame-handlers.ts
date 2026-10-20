import { ipcMain } from 'electron'
import type { GitFileBlame } from '../../../shared/git-blame'
import { getFileBlame } from '../../git/blame'
import { resolveRegisteredWorktreePath } from '../registered-worktree-roots-cache'
import { getLocalGitOptionsForRegisteredWorktree } from '../local-worktree-runtime-options'
import { validateGitRelativeFilePath } from '../filesystem-path-containment'
import type { FilesystemHandlerContext } from './filesystem-handler-context'
import { requireReachableGitRoute } from '../../providers/execution-host-provider-dispatch'
import { getConnectionExecutionHostId } from '../../../shared/execution-host'

export function registerFilesystemGitBlameHandlers(context: FilesystemHandlerContext): void {
  const { store } = context
  ipcMain.handle(
    'git:fileBlame',
    async (
      _event,
      args: { worktreePath: string; relativePath: string; contents: string; connectionId?: string }
    ): Promise<GitFileBlame> => {
      requireReachableGitRoute(getConnectionExecutionHostId(args.connectionId))
      const worktreePath = await resolveRegisteredWorktreePath(args.worktreePath, store)
      const relativePath = validateGitRelativeFilePath(worktreePath, args.relativePath)
      const gitOptions = getLocalGitOptionsForRegisteredWorktree(
        store,
        args.worktreePath,
        worktreePath
      )
      return getFileBlame(worktreePath, relativePath, String(args.contents), {
        ...gitOptions,
        admissionTier: 'interactive'
      })
    }
  )
}
