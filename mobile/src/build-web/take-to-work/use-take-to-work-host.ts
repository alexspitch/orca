import { useCallback, useEffect, useState } from 'react'
import { parseExecutionHostId } from '../../../../src/shared/execution-host'
import { isWslUncPath } from '../../../../src/shared/wsl-paths'
import { newTabRepoListRead } from '../../session/mobile-session-read-operations'
import type { RpcClient } from '../../transport/rpc-client'
import { worktreeCatalogRead } from '../../worktree/worktree-catalog-operations'
import { WORKTREE_PS_FULL_LIMIT } from '../../worktree/worktree-catalog-snapshot-client'
import type { TakeToWorkRepo, TakeToWorkWorktree } from './build-web-take-to-work'

export type TakeToWorkHost =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; repos: TakeToWorkRepo[]; worktrees: TakeToWorkWorktree[] }

const text = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined)

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

// Why the desktop's own only: a server workspace is launched through that server, not this host.
const onThisHost = (value: unknown): boolean =>
  parseExecutionHostId(text(value))?.kind !== 'runtime'

function readRepo(raw: Record<string, unknown>): TakeToWorkRepo | null {
  const id = text(raw.id)
  if (!id || !onThisHost(raw.executionHostId)) {
    return null
  }
  return {
    id,
    path: text(raw.path) ?? '',
    displayName: text(raw.displayName) ?? text(raw.path) ?? id,
    kind: raw.kind === 'folder' ? 'folder' : 'git',
    worktreeBaseRef: text(raw.worktreeBaseRef)?.trim() || null,
    ownLogin: Boolean(text(raw.connectionId)) || isWslUncPath(text(raw.path) ?? '')
  }
}

function readWorktree(raw: unknown): TakeToWorkWorktree | null {
  if (!isRecord(raw)) {
    return null
  }
  const worktreeId = text(raw.worktreeId) ?? text(raw.id)
  const repoId = text(raw.repoId)
  if (!worktreeId || !repoId || raw.workspaceKind === 'folder-workspace') {
    return null
  }
  if (!onThisHost(raw.hostId)) {
    return null
  }
  const hostId = text(raw.hostId)
  return {
    worktreeId,
    repoId,
    displayName: text(raw.displayName) || text(raw.branch) || worktreeId,
    branch: text(raw.branch),
    ...(hostId ? { hostId } : {}),
    isArchived: raw.isArchived === true
  }
}

/** The host's repositories and workspaces, as «Take to work» picks among them. */
export function useTakeToWorkHost(client: RpcClient): {
  host: TakeToWorkHost
  reload: () => void
} {
  const [host, setHost] = useState<TakeToWorkHost>({ kind: 'loading' })
  const [generation, setGeneration] = useState(0)
  useEffect(() => {
    let live = true
    setHost({ kind: 'loading' })
    void (async () => {
      try {
        const [repoReply, worktreeReply] = await Promise.all([
          newTabRepoListRead.request(client),
          worktreeCatalogRead.request(client, { limit: WORKTREE_PS_FULL_LIMIT })
        ])
        const repos = newTabRepoListRead.interpret(repoReply).flatMap((raw) => readRepo(raw) ?? [])
        const catalog = worktreeCatalogRead.interpret(worktreeReply)
        const rows = catalog.accepted ? (catalog.value.worktrees ?? []) : []
        const worktrees = rows.flatMap((raw) => readWorktree(raw) ?? [])
        if (live) {
          setHost({ kind: 'ready', repos, worktrees })
        }
      } catch (failure) {
        if (live) {
          setHost({
            kind: 'error',
            message:
              failure instanceof Error && failure.message.trim()
                ? failure.message
                : 'Could not load the workspaces of this host.'
          })
        }
      }
    })()
    return () => {
      live = false
    }
  }, [client, generation])
  const reload = useCallback(() => setGeneration((n) => n + 1), [])
  return { host, reload }
}
