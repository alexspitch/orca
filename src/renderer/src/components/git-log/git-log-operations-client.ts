import { GIT_LOG_OPERATIONS_RUNTIME_CAPABILITY } from '../../../../shared/git-log-page-capability'
import type {
  GitLogChangedPath,
  GitLogOperation,
  GitLogOperationResult,
  GitLogTreeAtRevision
} from '../../../../shared/git-log-operation-types'
import { isGitLogNetworkOperation } from '../../../../shared/git-log-operations'
import type { GitDiffResult } from '../../../../shared/git-diff-compare-types'
import { joinPath } from '@/lib/path'
import type { RuntimeGitContext } from '@/runtime/runtime-git-client-context'
import { getRuntimeGitCommitDiff } from '@/runtime/runtime-git-diff-client'
import { readRuntimeFileContent } from '@/runtime/runtime-file-read-client'
import { callRuntimeRpc } from '@/runtime/runtime-rpc-client'
import { gitLogUnsupportedReason, selectorOf } from './git-log-client'

const OPERATION_TIMEOUT_MS = 60_000
const NETWORK_TIMEOUT_MS = 300_000

/** Hosts older than the Git page's write support get a read-only page. */
export async function canRunGitLogOperations(context: RuntimeGitContext): Promise<boolean> {
  return (await gitLogUnsupportedReason(context, GIT_LOG_OPERATIONS_RUNTIME_CAPABILITY)) === null
}

export function runGitLogOperation(
  context: RuntimeGitContext,
  operation: GitLogOperation
): Promise<GitLogOperationResult> {
  return callRuntimeRpc<GitLogOperationResult>(
    context.target,
    'git.logOperation',
    { worktree: selectorOf(context), operation },
    {
      timeoutMs: isGitLogNetworkOperation(operation) ? NETWORK_TIMEOUT_MS : OPERATION_TIMEOUT_MS
    }
  )
}

export function loadTreeAtRevision(
  context: RuntimeGitContext,
  commitId: string
): Promise<GitLogTreeAtRevision> {
  return callRuntimeRpc<GitLogTreeAtRevision>(
    context.target,
    'git.treeAtRevision',
    { worktree: selectorOf(context), commitId },
    { timeoutMs: OPERATION_TIMEOUT_MS }
  )
}

/** Files that differ from `base`: in `target`, or in the working tree when it is null. */
export function loadChangedPaths(
  context: RuntimeGitContext,
  base: string,
  target: string | null
): Promise<GitLogChangedPath[]> {
  return callRuntimeRpc<GitLogChangedPath[]>(
    context.target,
    'git.changedPaths',
    { worktree: selectorOf(context), base, ...(target ? { target } : {}) },
    { timeoutMs: OPERATION_TIMEOUT_MS }
  )
}

/** A file as it is in one commit (empty when the commit doesn't have it). */
export async function loadFileAtRevision(
  context: RuntimeGitContext,
  commitId: string,
  path: string
): Promise<GitDiffResult> {
  // Why commitDiff: with no parent its right side is exactly the blob at the commit.
  return getRuntimeGitCommitDiff(context, { commitOid: commitId, parentOid: null, filePath: path })
}

const BINARY: GitDiffResult = {
  kind: 'binary',
  originalContent: '',
  modifiedContent: '',
  originalIsBinary: true,
  modifiedIsBinary: true
}

/** A file in `base` (left) against the working tree (right), for Compare with Local. */
export async function loadWorkingTreeDiff(
  context: RuntimeGitContext,
  base: string,
  entry: GitLogChangedPath
): Promise<GitDiffResult> {
  const [before, after] = await Promise.all([
    entry.status === 'added'
      ? null
      : loadFileAtRevision(context, base, entry.oldPath ?? entry.path),
    entry.status === 'deleted'
      ? null
      : readRuntimeFileContent({
          target: context.target,
          filePath: joinPath(context.worktreePath, entry.path),
          relativePath: entry.path,
          worktreeId: context.worktreeId ?? undefined,
          connectionId: context.connectionId
        })
  ])
  if (before?.kind === 'binary' || after?.isBinary) {
    return BINARY
  }
  return {
    kind: 'text',
    originalContent: before?.modifiedContent ?? '',
    modifiedContent: after?.content ?? '',
    originalIsBinary: false,
    modifiedIsBinary: false
  }
}
