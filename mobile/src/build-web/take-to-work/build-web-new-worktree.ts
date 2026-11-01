import type { RpcClient } from '../../transport/rpc-client'
import { createWorktreeWithNameRetry } from '../../tasks/worktree-create-retry'
import { readNewWorktreeRuntimeCapabilities } from '../../tasks/worktree-create-capability'
import { repoDefaultBaseRefRead } from '../../source-control/mobile-repo-base-ref-operations'
import type { WorktreeBuildWebTaskRequest } from '../../../../src/shared/build-web-session-types'
import type { BuildWebIssueRow } from '../../../../src/shared/build-web-types'
import {
  BUILD_WEB_WORK_BRANCH_RUNTIME_CAPABILITY,
  BUILD_WEB_WORKTREE_TASK_RUNTIME_CAPABILITY
} from '../../../../src/shared/build-web-capability'
import { worktreeFolderName } from '../../../../src/shared/build-web-task-session-worktree'

// «Take to work» in a new worktree: the host makes it with the repo's own setup policy, then the
// session is launched in it like in any existing one.

/**
 * The task link a host keeps, and the console's branch when the host names the worktree's branch
 * after it. Why gated: an older host strips either field, and the sheet would promise what it dropped.
 */
export function taskLinkForHost(
  issue: Pick<BuildWebIssueRow, 'id' | 'key' | 'work_branch'>,
  consoleHost: string | null,
  hostCapabilities: readonly string[]
): { buildWebTask?: WorktreeBuildWebTaskRequest; workBranch?: string } {
  if (!consoleHost || !hostCapabilities.includes(BUILD_WEB_WORKTREE_TASK_RUNTIME_CAPABILITY)) {
    return {}
  }
  const workBranch = hostCapabilities.includes(BUILD_WEB_WORK_BRANCH_RUNTIME_CAPABILITY)
    ? issue.work_branch || undefined
    : undefined
  const link = { issueId: issue.id, key: issue.key, consoleHost }
  return workBranch ? { buildWebTask: { ...link, workBranch }, workBranch } : { buildWebTask: link }
}

/** A worktree made for a task: `name` is its label, `folder` what the console keeps. */
export type CreatedTaskWorktree = { worktreeId: string; name: string; folder: string }

export async function createTaskWorktree(args: {
  client: RpcClient
  repoId: string
  name: string
  /** Always named: the sheet fills in the repository's default and lets the person pick another. */
  baseBranch: string
  /** The repo's own policy decides unless the person chose; a repo that asks refuses `inherit`. */
  setupDecision: 'inherit' | 'run' | 'skip'
  /** The task the worktree is made for; only for a host that announces it keeps one. */
  buildWebTask?: WorktreeBuildWebTaskRequest
  /** The sidebar label; the folder keeps `name`, the branch too unless the task names its own. */
  displayName?: string
}): Promise<CreatedTaskWorktree | { error: string }> {
  const created = await createWorktreeWithNameRetry({
    client: args.client,
    baseName: args.name,
    nameWasGenerated: false,
    worktreeCreateIdempotency: readNewWorktreeRuntimeCapabilities(args.client).then(
      (capabilities) => capabilities?.worktreeCreateIdempotency ?? false,
      () => false
    ),
    buildParams: (name) => ({
      repo: `id:${args.repoId}`,
      name,
      displayName: args.displayName ?? args.name,
      displayNameKind: 'user',
      baseBranch: args.baseBranch.trim(),
      setupDecision: args.setupDecision,
      ...(args.buildWebTask ? { buildWebTask: args.buildWebTask } : {})
    })
  })
  if ('error' in created) {
    return /setup decision required/i.test(created.error)
      ? { error: 'This repository asks whether to run its setup script: choose Run or Skip.' }
      : { error: `Could not create the worktree: ${created.error}` }
  }
  return {
    worktreeId: created.worktreeId,
    name: created.name,
    folder: worktreeFolderName(created.path) || args.name
  }
}

/** The branch a new worktree of the repo starts from: the project's own default, else git's. */
export async function readDefaultBaseRef(
  client: RpcClient,
  repo: { id: string; worktreeBaseRef?: string | null }
): Promise<string | null> {
  if (repo.worktreeBaseRef) {
    return repo.worktreeBaseRef
  }
  try {
    return repoDefaultBaseRefRead.interpret(
      await repoDefaultBaseRefRead.request(client, { repo: `id:${repo.id}` })
    )
  } catch {
    return null
  }
}
