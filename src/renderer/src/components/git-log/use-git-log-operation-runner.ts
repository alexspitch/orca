import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import type { RuntimeGitContext } from '@/runtime/runtime-git-client-context'
import { errorMessage } from '../../../../shared/error-message'
import type {
  GitLogConflictOperation,
  GitLogOperation,
  GitLogOperationResult
} from '../../../../shared/git-log-operation-types'
import type { Worktree } from '../../../../shared/worktree/types'
import { useConfirmationDialog } from '../confirmation-dialog-context'
import { runGitLogOperation } from './git-log-operations-client'

const FILES_LISTED = 5

/** What the toasts say for one operation. */
export type GitLogOperationLabels = { pending: string; done: string; failed: string }

// Why loose: git prints `/private/var/…` for macOS temp paths and `C:/…` for Windows ones.
function samePath(left: string, right: string): boolean {
  const normalize = (path: string) =>
    path
      .replace(/\\/g, '/')
      .replace(/\/+$/, '')
      .replace(/^\/private(?=\/)/, '')
      .toLowerCase()
  return normalize(left) === normalize(right)
}

function conflictTitle(operation: GitLogConflictOperation): string {
  if (operation === 'merge') {
    return translate('gitLog.op.mergeConflicts', 'The merge hit conflicts and was undone')
  }
  return operation === 'rebase'
    ? translate('gitLog.op.rebaseConflicts', 'The rebase hit conflicts and was undone')
    : translate('gitLog.op.cherryPickConflicts', 'The cherry-pick hit conflicts and was undone')
}

function listFiles(files: string[]): string {
  const shown = files.slice(0, FILES_LISTED).join(', ')
  return files.length > FILES_LISTED
    ? translate('gitLog.op.moreFiles', '{{value0}} and {{value1}} more', {
        value0: shown,
        value1: files.length - FILES_LISTED
      })
    : shown
}

/**
 * Runs one operation at a time in the picked worktree: a pending toast, then the outcome. A branch
 * held by another worktree offers to switch to it; an unmerged branch asks before `-D`.
 */
export function useGitLogOperationRunner({
  context,
  worktrees,
  onPickWorktree,
  onChanged
}: {
  context: RuntimeGitContext
  worktrees: readonly Worktree[]
  onPickWorktree: (worktreeId: string) => void
  onChanged: () => void
}): {
  busy: boolean
  perform: (
    operation: GitLogOperation,
    labels: GitLogOperationLabels,
    options?: { quietFailure?: boolean }
  ) => Promise<GitLogOperationResult | null>
} {
  const confirm = useConfirmationDialog()
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)

  const perform = useCallback(
    async (
      operation: GitLogOperation,
      labels: GitLogOperationLabels,
      options: { quietFailure?: boolean } = {}
    ): Promise<GitLogOperationResult | null> => {
      if (busyRef.current) {
        toast.info(translate('gitLog.op.busy', 'Another Git operation is still running.'))
        return null
      }
      busyRef.current = true
      setBusy(true)
      const toastId = toast.loading(labels.pending)
      let result: GitLogOperationResult
      try {
        result = await runGitLogOperation(context, operation)
      } catch (error) {
        result = { status: 'failed', message: errorMessage(error) }
      } finally {
        busyRef.current = false
        setBusy(false)
        onChanged()
      }
      if (result.status === 'done') {
        toast.success(labels.done, { id: toastId, description: result.message })
      } else if (result.status === 'failed') {
        if (options.quietFailure) {
          toast.dismiss(toastId)
        } else {
          toast.error(labels.failed, { id: toastId, description: result.message })
        }
      } else if (result.status === 'conflict-aborted') {
        toast.error(conflictTitle(result.operation), {
          id: toastId,
          description: translate('gitLog.op.conflictFiles', 'Conflicts in {{value0}}', {
            value0: listFiles(result.files)
          })
        })
      } else if (result.status === 'branch-in-worktree') {
        toast.dismiss(toastId)
        const holder = worktrees.find((worktree) => samePath(worktree.path, result.worktreePath))
        if (!holder) {
          toast.error(labels.failed, {
            description: translate(
              'gitLog.op.heldElsewhere',
              '“{{value0}}” is checked out in another worktree at {{value1}}.',
              { value0: result.branch, value1: result.worktreePath }
            )
          })
        } else if (
          await confirm({
            title: translate('gitLog.op.heldTitle', '“{{value0}}” is checked out in “{{value1}}”', {
              value0: result.branch,
              value1: holder.displayName
            }),
            description: translate(
              'gitLog.op.heldDescription',
              'Git keeps a branch in one worktree at a time. Switch the Git page to that worktree?'
            ),
            confirmLabel: translate('gitLog.op.switch', 'Switch to {{value0}}', {
              value0: holder.displayName
            })
          })
        ) {
          onPickWorktree(holder.id)
        }
      } else if (result.status === 'not-fully-merged' && operation.kind === 'deleteBranch') {
        toast.dismiss(toastId)
        if (
          await confirm({
            title: translate('gitLog.op.unmergedTitle', '“{{value0}}” is not fully merged', {
              value0: result.branch
            }),
            description: translate(
              'gitLog.op.unmergedDescription',
              'It isn’t merged into the current branch or its upstream. Delete it anyway? Commits no other branch holds will be lost.'
            ),
            confirmLabel: translate('gitLog.op.forceDelete', 'Delete Anyway'),
            confirmVariant: 'destructive'
          })
        ) {
          return perform({ ...operation, force: true }, labels, options)
        }
      }
      return result
    },
    [confirm, context, onChanged, onPickWorktree, worktrees]
  )

  return { busy, perform }
}
