import { parseGitBlamePorcelain, type GitFileBlame } from '../../shared/git-blame'
import type { GitRuntimeOptions } from './git-runtime-options'
import { gitReadOptionsForWorktree } from './git-runtime-options'
import { gitExecFileAsync } from './runner'

/**
 * Who last changed each line of `contents` — the file as the editor holds it, so lines match even
 * before a save; lines git has not seen carry the all-zero sha.
 */
export async function getFileBlame(
  worktreePath: string,
  relativePath: string,
  contents: string,
  options: GitRuntimeOptions = {}
): Promise<GitFileBlame> {
  const { stdout } = await gitExecFileAsync(
    ['-c', 'core.quotePath=false', 'blame', '--porcelain', '--contents', '-', '--', relativePath],
    { ...gitReadOptionsForWorktree(worktreePath, options), stdin: contents }
  )
  return parseGitBlamePorcelain(stdout)
}
