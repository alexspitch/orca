import type { GitFileBlame } from '../../../shared/git-blame'
import { resolveLocalWorktreePath, type RuntimeGitContext } from './runtime-git-client-context'
import { callRuntimeRpc } from './runtime-rpc-client'
import { toRuntimeWorktreeSelector } from './runtime-worktree-selector'

// Why the read deadline, not the usual 15 s: blame walks the file's whole history.
const BLAME_TIMEOUT_MS = 120_000

export async function getRuntimeGitFileBlame(
  context: RuntimeGitContext,
  args: { relativePath: string; contents: string }
): Promise<GitFileBlame> {
  const target = context.target
  if (target.kind === 'local' || !context.worktreeId) {
    return window.api.git.fileBlame({
      worktreePath: resolveLocalWorktreePath(context),
      relativePath: args.relativePath,
      contents: args.contents,
      connectionId: context.connectionId
    })
  }
  return callRuntimeRpc<GitFileBlame>(
    target,
    'git.fileBlame',
    {
      worktree: toRuntimeWorktreeSelector(context.worktreeId),
      relativePath: args.relativePath,
      contents: args.contents
    },
    { timeoutMs: BLAME_TIMEOUT_MS }
  )
}
