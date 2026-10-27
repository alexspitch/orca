import type { RpcClient } from '../../transport/rpc-client'
import { createWorktreeWithNameRetry } from '../../tasks/worktree-create-retry'
import { readNewWorktreeRuntimeCapabilities } from '../../tasks/worktree-create-capability'
import { repoDefaultBaseRefRead } from '../../source-control/mobile-repo-base-ref-operations'

// «Take to work» in a new worktree: the host makes it with the repo's own setup policy, then the
// session is launched in it like in any existing one.

export async function createBatchWorktree(args: {
  client: RpcClient
  repoId: string
  name: string
  /** Always named: the sheet fills in the repository's default and lets the person pick another. */
  baseBranch: string
  /** The repo's own policy decides unless the person chose; a repo that asks refuses `inherit`. */
  setupDecision: 'inherit' | 'run' | 'skip'
}): Promise<{ worktreeId: string; name: string } | { error: string }> {
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
      displayName: args.name,
      displayNameKind: 'user',
      baseBranch: args.baseBranch.trim(),
      setupDecision: args.setupDecision
    })
  })
  if ('error' in created) {
    return /setup decision required/i.test(created.error)
      ? { error: 'This repository asks whether to run its setup script: choose Run or Skip.' }
      : { error: `Could not create the worktree: ${created.error}` }
  }
  return { worktreeId: created.worktreeId, name: created.name }
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
