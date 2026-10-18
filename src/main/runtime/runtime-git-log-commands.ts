import type { GitHistoryExecutor } from '../../shared/git-history-types'
import {
  listGitRefsContainingFromExecutor,
  listGitRefsFromExecutor,
  loadGitLogPageFromExecutor
} from '../../shared/git-log-page'
import type {
  GitLogPageResult,
  GitLogQuery,
  GitRefsContainingResult,
  GitRefsResult
} from '../../shared/git-log-page-types'
import { isGitLogNetworkOperation, runGitLogOperation } from '../../shared/git-log-operations'
import { listChangedPaths, listTreeAtRevision } from '../../shared/git-log-commit-operations'
import type {
  GitLogChangedPath,
  GitLogOperation,
  GitLogOperationResult,
  GitLogTreeAtRevision
} from '../../shared/git-log-operation-types'
import { runWithGitWorktreeOperationLock } from '../../shared/git-worktree-operation-lock'
import { gitExecFileAsync } from '../git/runner'
import { gitOptionsForWorktree, gitReadOptionsForWorktree } from '../git/git-runtime-options'
import {
  postponeRepoRefMaintenance,
  withRepoRefMaintenancePaused
} from '../git/local-repo-ref-maintenance'
import { detectConflictOperation } from '../git/source-control/git-conflict-operation'
import { runWithGitReadCacheInvalidation } from '../git/source-control/git-read-cache-invalidation'
import type { GitRuntimeOptions } from '../git/git-runtime-options'
import {
  localGitOptionsForTarget,
  requireLocalRuntimeGitRoute,
  type RuntimeGitCommandHost
} from './runtime-git-command-target'

// Why a deadline: the client stops waiting at 60 s; git must not keep a slot after that.
const GIT_LOG_COMMAND_TIMEOUT_MS = 55_000
// Fetch, pull and push wait on the network; the client allows 5 minutes.
const GIT_LOG_NETWORK_TIMEOUT_MS = 295_000
// Why bounded: an operation still queued when the client gives up would run unseen later.
const GIT_LOG_LOCK_WAIT_MS = 15_000
// Why a floor: an abort after a stopped merge must get its turn even late in the budget.
const GIT_LOG_MIN_STEP_MS = 5_000
// Why larger than the default: `ls-tree -r` of a big repository is tens of megabytes.
const GIT_LOG_TREE_MAX_BUFFER = 64 * 1024 * 1024

const STOPPING_OPERATIONS = new Set<GitLogOperation['kind']>([
  'merge',
  'rebase',
  'checkoutAndRebase',
  'cherryPick'
])

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

/** The Git page: the all-branch log, the ref list, and the branch and commit operations. */
export class RuntimeGitLogCommands {
  constructor(private readonly host: RuntimeGitCommandHost) {}

  private async executorFor(
    worktreeSelector: string,
    access: { write?: boolean; budgetMs?: number; maxBuffer?: number } = {}
  ): Promise<{ git: GitHistoryExecutor; cwd: string; options: GitRuntimeOptions }> {
    const target = await this.host.resolveRuntimeGitTarget(worktreeSelector)
    // Same routing as the provider (ssh: and runtime: hosts throw); a person is waiting, so interactive.
    requireLocalRuntimeGitRoute(target)
    const options = { ...localGitOptionsForTarget(target), admissionTier: 'interactive' as const }
    // Why two option sets: only reads may take WSL's direct-git shortcut.
    const optionsFor = access.write ? gitOptionsForWorktree : gitReadOptionsForWorktree
    // One deadline for the whole call, however many git commands it takes.
    const deadline = Date.now() + (access.budgetMs ?? GIT_LOG_COMMAND_TIMEOUT_MS)
    return {
      git: (args, cwd) =>
        gitExecFileAsync(args, {
          ...optionsFor(cwd, options),
          timeout: Math.max(GIT_LOG_MIN_STEP_MS, deadline - Date.now()),
          ...(access.maxBuffer ? { maxBuffer: access.maxBuffer } : {})
        }),
      cwd: target.worktree.path,
      options
    }
  }

  async runOperation(
    worktreeSelector: string,
    operation: GitLogOperation
  ): Promise<GitLogOperationResult> {
    const { git, cwd, options } = await this.executorFor(worktreeSelector, {
      write: true,
      budgetMs: isGitLogNetworkOperation(operation)
        ? GIT_LOG_NETWORK_TIMEOUT_MS
        : GIT_LOG_COMMAND_TIMEOUT_MS
    })
    // Why paused: deleting or pruning refs needs packed-refs.lock, which an idle pack may hold.
    postponeRepoRefMaintenance()
    try {
      return await withRepoRefMaintenancePaused(`git-log-${operation.kind}`, () =>
        // Why both: one Git write per worktree at a time, and no cached status read survives it.
        runWithGitWorktreeOperationLock(cwd, AbortSignal.timeout(GIT_LOG_LOCK_WAIT_MS), () =>
          runWithGitReadCacheInvalidation(async () => {
            // A failed merge, rebase or cherry-pick is aborted; never one the user had started.
            if (
              STOPPING_OPERATIONS.has(operation.kind) &&
              (await detectConflictOperation(cwd, options)) !== 'unknown'
            ) {
              return {
                status: 'failed' as const,
                message:
                  'A merge, rebase or cherry-pick is already in progress in this worktree. Finish or abort it first.'
              }
            }
            return runGitLogOperation(git, cwd, operation)
          })
        )
      )
    } catch (error) {
      if (isAbortError(error)) {
        return {
          status: 'failed',
          message: 'Another Git operation is running in this worktree. Try again when it finishes.'
        }
      }
      throw error
    }
  }

  async treeAtRevision(worktreeSelector: string, commitId: string): Promise<GitLogTreeAtRevision> {
    const { git, cwd } = await this.executorFor(worktreeSelector, {
      maxBuffer: GIT_LOG_TREE_MAX_BUFFER
    })
    return listTreeAtRevision({ git, cwd }, commitId)
  }

  async changedPaths(
    worktreeSelector: string,
    base: string,
    target: string | null
  ): Promise<GitLogChangedPath[]> {
    const { git, cwd } = await this.executorFor(worktreeSelector)
    return listChangedPaths({ git, cwd }, base, target)
  }

  async getLogPage(worktreeSelector: string, query: GitLogQuery): Promise<GitLogPageResult> {
    const { git, cwd } = await this.executorFor(worktreeSelector)
    return loadGitLogPageFromExecutor(git, cwd, query)
  }

  async listRefs(worktreeSelector: string): Promise<GitRefsResult> {
    const { git, cwd } = await this.executorFor(worktreeSelector)
    return listGitRefsFromExecutor(git, cwd)
  }

  async listRefsContaining(
    worktreeSelector: string,
    commitId: string
  ): Promise<GitRefsContainingResult> {
    const { git, cwd } = await this.executorFor(worktreeSelector)
    return listGitRefsContainingFromExecutor(git, cwd, commitId)
  }
}
