import type { RpcClient } from '../../transport/rpc-client'
import { createWorktreeWithNameRetry } from '../../tasks/worktree-create-retry'
import { readNewWorktreeRuntimeCapabilities } from '../../tasks/worktree-create-capability'
import { repoDefaultBaseRefRead } from '../../source-control/mobile-repo-base-ref-operations'
import type { WorktreeBuildWebTaskRequest } from '../../../../src/shared/build-web-session-types'
import { worktreeFolderName } from '../../../../src/shared/build-web-task-session-worktree'

// «Take to work» in a new worktree: the host makes it with the repo's own setup policy, then the
// session is launched in it like in any existing one.

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
  /** The sidebar label; the folder and branch keep `name`. */
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
