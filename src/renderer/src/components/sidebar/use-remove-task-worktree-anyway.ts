import { useCallback } from 'react'
import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { getAllWorktreesFromState, getWorktreeOnHostFromState } from '@/store/selectors'
import { translate } from '@/i18n/i18n'
import { collectRemovalUnsavedFiles } from '@/components/editor/removal-unsaved-editor-files'
import { confirmUnsavedDiscard } from '@/store/slices/worktrees/teardown/removed-workspace-unsaved-files'
import type { Worktree } from '../../../../shared/worktree/types'
import { getWorktreeHostIdentity } from '../../../../shared/worktree/host-qualified-identity'
import { BUILD_WEB_SESSION_ACTION_LABELS } from '../../../../shared/build-web-session-labels'
import { useConfirmationDialog } from '../confirmation-dialog-context'
import { runWorktreeDeletesInParallel } from './delete-worktree-flow'
import { discardedUnsavedFilesLabel } from './removal-unsaved-files'
import { showWorkspaceListChangedToast } from './stale-workspace-list-toast'
import { getWorkspaceDeleteLineage } from './workspace-delete-lineage'
import {
  LEFTOVER_LINES_LISTED,
  readTaskWorktreeLeftovers,
  type TaskWorktreeLeftovers
} from './task-worktree-leftovers'

// IS-147 «Remove anyway»: a closed task's worktree the host would not remove. It runs the delete
// flow's force removal, which skips only the dirty check; the branch goes with `-d`, so an unmerged
// branch survives. Lineage children go with it, as the Delete dialog removes them.

function section(title: string, lines: readonly string[], total = lines.length): string {
  const shown = lines.slice(0, LEFTOVER_LINES_LISTED).map((line) => `  ${line}`)
  const more = total > shown.length ? [`  … ${total - shown.length}`] : []
  return [title, ...shown, ...more].join('\n')
}

function describeCommits(worktree: Worktree, commits: TaskWorktreeLeftovers['commits']): string {
  const branch = worktree.branch.replace(/^refs\/heads\//, '')
  return commits && commits.total > 0
    ? section(
        translate('buildWeb.session.remove.commits', 'Kept on branch {{branch}}:', { branch }),
        commits.lines,
        commits.total
      )
    : translate(
        'buildWeb.session.remove.noCommits',
        'Branch {{branch}} has no commits of its own.',
        {
          branch
        }
      )
}

function describe(
  worktree: Worktree,
  { commits, files }: TaskWorktreeLeftovers,
  children: readonly Worktree[],
  unsavedPaths: readonly string[]
): string {
  const parts: string[] = []
  if (commits) {
    parts.push(describeCommits(worktree, commits))
  }
  if (files && files.length > 0) {
    parts.push(section(translate('buildWeb.session.remove.files', 'Lost:'), files))
  }
  if (unsavedPaths.length > 0) {
    parts.push(section(discardedUnsavedFilesLabel(unsavedPaths.length), unsavedPaths))
  }
  if (children.length > 0) {
    parts.push(
      section(
        children.length === 1
          ? translate(
              'auto.components.sidebar.DeleteWorktreeLineageNotice.66798cc6a2',
              'Deleting this workspace also deletes 1 child workspace.'
            )
          : translate(
              'auto.components.sidebar.DeleteWorktreeLineageNotice.29b98bf9cd',
              'Deleting this workspace also deletes {{value0}} child workspaces.',
              { value0: children.length }
            ),
        children.map((child) => child.displayName)
      )
    )
  }
  if (commits === null || files === null) {
    parts.push(
      translate('buildWeb.session.remove.unread', 'Orca could not read every change in it.')
    )
  }
  parts.push(
    translate(
      BUILD_WEB_SESSION_ACTION_LABELS.removeRule.key,
      BUILD_WEB_SESSION_ACTION_LABELS.removeRule.text
    )
  )
  return parts.join('\n\n')
}

/** The row as the store holds it now; a removed or recreated workspace refuses the action. */
function currentCopy(worktree: Worktree): Worktree | null {
  const current = getWorktreeOnHostFromState(useAppStore.getState(), worktree.id, worktree.hostId)
  return current && current.instanceId === worktree.instanceId ? current : null
}

/** Asks with what is kept and lost; the confirmed targets, children first, or null. */
async function askToRemove(
  target: Worktree,
  confirm: ReturnType<typeof useConfirmationDialog>
): Promise<Worktree[] | null> {
  const state = useAppStore.getState()
  if (target.hostId) {
    state.clearWorktreeDeleteState(target.id, target.hostId)
  } else {
    state.clearWorktreeDeleteState(target.id)
  }
  const lineage = getWorkspaceDeleteLineage(
    target,
    getAllWorktreesFromState(state),
    state.worktreeLineageById
  )
  const pending = toast.loading(
    translate('buildWeb.session.remove.reading', 'Reading what {{name}} holds…', {
      name: target.displayName
    })
  )
  const leftovers = await readTaskWorktreeLeftovers(target).finally(() => toast.dismiss(pending))
  const targets = lineage.descendants.length > 0 ? lineage.deleteAllTargets : [target]
  const unsaved = collectRemovalUnsavedFiles(useAppStore.getState, targets)
  const confirmed = await confirm({
    title: translate('buildWeb.session.remove.title', 'Remove workspace {{name}}?', {
      name: target.displayName
    }),
    description: describe(
      target,
      leftovers,
      lineage.descendants,
      unsaved.map((file) => file.relativePath || file.filePath)
    ),
    descriptionClassName: 'whitespace-pre-line',
    confirmLabel: translate('buildWeb.session.remove.confirm', 'Remove workspace'),
    confirmVariant: 'destructive'
  })
  return confirmed ? targets : null
}

// Why: reading a host's git can take up to 15 s; a second click must not stack another dialog.
const inFlight = new Set<string>()

/** Confirms with what is kept and lost, then runs the delete flow's force removal. */
export function useRemoveTaskWorktreeAnyway(): (worktree: Worktree) => Promise<void> {
  const confirm = useConfirmationDialog()
  return useCallback(
    async (worktree) => {
      const target = currentCopy(worktree)
      if (!target) {
        showWorkspaceListChangedToast()
        return
      }
      const identity = getWorktreeHostIdentity(target)
      if (inFlight.has(identity)) {
        return
      }
      inFlight.add(identity)
      try {
        const targets = await askToRemove(target, confirm)
        if (!targets) {
          return
        }
        // Why again: a workspace may have been removed or recreated while the dialog was open.
        if (targets.some((entry) => !currentCopy(entry))) {
          showWorkspaceListChangedToast()
          return
        }
        await runWorktreeDeletesInParallel(targets, {
          force: true,
          confirmedDiscards: confirmUnsavedDiscard(useAppStore.getState, targets)
        })
      } finally {
        inFlight.delete(identity)
      }
    },
    [confirm]
  )
}
