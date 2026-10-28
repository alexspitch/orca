import { useCallback } from 'react'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { getConnectionId } from '@/lib/connection-context'
import { runtimeTargetForWorkspaceOwner } from '@/lib/resolve-owner'
import { ipcOrRuntimeTargetForHostId } from '@/runtime/runtime-client-target'
import type { RuntimeGitContext } from '@/runtime/runtime-git-client-context'
import { getRuntimeGitHistory, getRuntimeGitStatus } from '@/runtime/runtime-git-status-client'
import { findRepoForHost } from '@/store/slices/repo-host-identity'
import { toWorktreeRemovalTarget } from '../../../../shared/worktree/removal'
import type { Worktree } from '../../../../shared/worktree/types'
import { useConfirmationDialog } from '../confirmation-dialog-context'
import { runWorktreeDeleteWithToast } from './run-worktree-delete-with-toast'

// IS-147 «Remove anyway»: a closed task's worktree the host would not remove. The existing force
// delete skips only the dirty check; the branch goes with `-d`, so an unmerged branch survives.

const LISTED = 12

function gitContext(worktree: Worktree): RuntimeGitContext | null {
  const state = useAppStore.getState()
  const target = worktree.hostId
    ? ipcOrRuntimeTargetForHostId(worktree.hostId)
    : runtimeTargetForWorkspaceOwner(state, { workspaceId: worktree.id })
  if (!target) {
    return null
  }
  const owner = worktree.hostId
    ? findRepoForHost(state.repos, worktree.repoId, { hostId: worktree.hostId })
    : undefined
  return {
    target,
    worktreeId: worktree.id,
    worktreePath: worktree.path,
    connectionId: worktree.hostId
      ? (owner?.connectionId ?? undefined)
      : (getConnectionId(worktree.id) ?? undefined)
  }
}

/** Commits the branch holds over its base, and the files a removal loses; null when unreadable. */
async function readLeftovers(
  worktree: Worktree
): Promise<{ commits: string[] | null; files: string[] | null }> {
  const context = gitContext(worktree)
  if (!context) {
    return { commits: null, files: null }
  }
  const [history, status] = await Promise.all([
    worktree.baseRef
      ? getRuntimeGitHistory(context, { baseRef: worktree.baseRef, limit: LISTED + 1 }).catch(
          () => null
        )
      : Promise.resolve(null),
    getRuntimeGitStatus(context, { admissionTier: 'interactive', includeLineStats: false }).catch(
      () => null
    )
  ])
  const baseIndex = history?.items.findIndex((item) => item.id === history.mergeBase) ?? -1
  // Why all when the base is not listed: the branch holds more commits than the page shows.
  const ahead = history ? history.items.slice(0, baseIndex >= 0 ? baseIndex : undefined) : null
  return {
    commits:
      ahead?.map((item) => `${item.displayId ?? item.id.slice(0, 7)} ${item.subject}`) ?? null,
    files: status?.entries.map((entry) => `${entry.status} ${entry.path}`) ?? null
  }
}

function section(title: string, lines: string[]): string {
  const shown = lines.slice(0, LISTED).map((line) => `  ${line}`)
  const more = lines.length > LISTED ? [`  … ${lines.length - LISTED}`] : []
  return [title, ...shown, ...more].join('\n')
}

function describe(worktree: Worktree, commits: string[] | null, files: string[] | null): string {
  const parts: string[] = []
  if (commits && commits.length > 0) {
    parts.push(
      section(
        translate('buildWeb.session.remove.commits', 'Kept on branch {{branch}}:', {
          branch: worktree.branch.replace(/^refs\/heads\//, '')
        }),
        commits
      )
    )
  }
  if (files && files.length > 0) {
    parts.push(section(translate('buildWeb.session.remove.files', 'Lost:'), files))
  }
  if (commits === null || files === null) {
    parts.push(
      translate('buildWeb.session.remove.unread', 'Orca could not read every change in it.')
    )
  }
  parts.push(
    translate(
      'buildWeb.session.remove.rule',
      'Uncommitted, untracked and ignored files are lost. The branch is deleted only when merged; an unmerged branch is kept.'
    )
  )
  return parts.join('\n\n')
}

/** Confirms with what is kept and lost, then runs the existing force delete. */
export function useRemoveTaskWorktreeAnyway(): (worktree: Worktree) => Promise<void> {
  const confirm = useConfirmationDialog()
  return useCallback(
    async (worktree) => {
      const { commits, files } = await readLeftovers(worktree)
      const confirmed = await confirm({
        title: translate('buildWeb.session.remove.title', 'Remove workspace {{name}}?', {
          name: worktree.displayName
        }),
        description: describe(worktree, commits, files),
        descriptionClassName: 'whitespace-pre-line',
        confirmLabel: translate('buildWeb.session.remove.confirm', 'Remove workspace'),
        confirmVariant: 'destructive'
      })
      if (confirmed) {
        await runWorktreeDeleteWithToast(toWorktreeRemovalTarget(worktree), worktree.displayName, {
          force: true
        })
      }
    },
    [confirm]
  )
}
