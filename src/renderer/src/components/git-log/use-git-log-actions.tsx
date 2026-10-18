import React, { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import type { RuntimeGitContext } from '@/runtime/runtime-git-client-context'
import { errorMessage } from '../../../../shared/error-message'
import type { GitHistoryItem } from '../../../../shared/git-history'
import type { GitLogOperation } from '../../../../shared/git-log-operation-types'
import type { GitRefEntry } from '../../../../shared/git-log-page-types'
import { splitRemoteBranchName } from '../../../../shared/git-remote-branch-name'
import type { Worktree } from '../../../../shared/worktree/types'
import { useConfirmationDialog } from '../confirmation-dialog-context'
import { isGitLogFavoriteRef } from './git-log-branch-tree'
import { revisionsDiffTarget, workingTreeDiffTarget } from './git-log-compare-targets'
import type { GitLogBranchActionId, GitLogCommitActionId } from './git-log-menus'
import { gitLogOperationLabels } from './git-log-operation-labels'
import { canRunGitLogOperations } from './git-log-operations-client'
import {
  readGitLogViewPrefs,
  writeGitLogFavorites,
  type GitLogFavorites
} from './git-log-view-prefs'
import type { GitLogDiffTarget } from './GitLogDiffDialog'
import { GitLogNameDialog, type GitLogNameRequest } from './GitLogNameDialog'
import { GitLogRevisionDialog, type GitLogRevisionTarget } from './GitLogRevisionDialog'
import { useGitLogOperationRunner } from './use-git-log-operation-runner'

/** The commit menu items this hook runs; the reading ones stay with the workspace. */
export type GitLogWriteCommitAction = Extract<
  GitLogCommitActionId,
  'cherryPick' | 'checkoutRevision' | 'showRepository' | 'compareWithLocal' | 'newBranch' | 'newTag'
>
export type GitLogWriteBranchAction = Exclude<GitLogBranchActionId, 'showInLog'>

export type GitLogActions = {
  /** False until the host is known to run Git page operations; menus then show reading items only. */
  canWrite: boolean
  busy: boolean
  runCommitAction: (action: GitLogWriteCommitAction, item: GitHistoryItem) => void
  runBranchAction: (action: GitLogWriteBranchAction, ref: GitRefEntry) => void
  newBranchFromHead: () => void
  fetchAll: () => void
  isFavorite: (ref: GitRefEntry) => boolean
  toggleFavorite: (ref: GitRefEntry) => void
  dialogs: React.JSX.Element
}

const NO_FAVORITES: GitLogFavorites = { added: [], removed: [] }

/** Branch and commit operations of the Git page, with the dialogs and confirmations they need. */
export function useGitLogActions({
  context,
  repoId,
  worktreePath,
  worktrees,
  onPickWorktree,
  currentBranch,
  headOid,
  onChanged,
  onShowDiff
}: {
  context: RuntimeGitContext
  repoId: string
  worktreePath: string
  worktrees: readonly Worktree[]
  onPickWorktree: (worktreeId: string) => void
  currentBranch: string | null
  headOid: string | null
  onChanged: () => void
  onShowDiff: (target: GitLogDiffTarget) => void
}): GitLogActions {
  const confirm = useConfirmationDialog()
  const runner = useGitLogOperationRunner({ context, worktrees, onPickWorktree, onChanged })
  const [canWrite, setCanWrite] = useState(false)
  const [nameRequest, setNameRequest] = useState<GitLogNameRequest | null>(null)
  const [revisionTarget, setRevisionTarget] = useState<GitLogRevisionTarget | null>(null)
  const [favorites, setFavorites] = useState(
    () => readGitLogViewPrefs().favoritesByRepo[repoId] ?? NO_FAVORITES
  )

  useEffect(() => {
    let stale = false
    setCanWrite(false)
    canRunGitLogOperations(context).then(
      (value) => !stale && setCanWrite(value),
      () => !stale && setCanWrite(false)
    )
    return () => {
      stale = true
    }
  }, [context])

  const run = (operation: GitLogOperation) =>
    void runner.perform(operation, gitLogOperationLabels(operation))
  const runConfirmed = (
    operation: GitLogOperation,
    question: Parameters<typeof confirm>[0]
  ): void =>
    void confirm(question).then((confirmed) => {
      if (confirmed) {
        run(operation)
      }
    })
  // From a dialog: a failure is shown under its field, which stays open.
  const submit = async (operation: GitLogOperation): Promise<string | null> => {
    const result = await runner.perform(operation, gitLogOperationLabels(operation), {
      quietFailure: true
    })
    if (!result) {
      return translate('gitLog.op.busy', 'Another Git operation is still running.')
    }
    return result.status === 'failed' ? result.message : null
  }
  const showDiff = (pending: Promise<GitLogDiffTarget | null>) =>
    void pending.then(
      (target) =>
        target
          ? onShowDiff(target)
          : toast.info(translate('gitLog.compare.none', 'No differences')),
      (error: unknown) =>
        toast.error(translate('gitLog.compare.failed', 'Couldn’t compare'), {
          description: errorMessage(error)
        })
    )

  const askNewBranch = (startPoint: string, from: string, initialName: string) =>
    setNameRequest({
      title: translate('gitLog.newBranch.title', 'New Branch'),
      description: translate('gitLog.newBranch.description', 'Create a branch from {{value0}}.', {
        value0: from
      }),
      label: translate('gitLog.newBranch.label', 'Branch name'),
      initialName,
      confirmLabel: translate('gitLog.newBranch.create', 'Create'),
      checkbox: { label: translate('gitLog.newBranch.checkout', 'Checkout branch'), initial: true },
      submit: ({ name, checked }) =>
        submit({ kind: 'createBranch', name, startPoint, checkout: checked })
    })

  const runCommitAction = (action: GitLogWriteCommitAction, item: GitHistoryItem) => {
    const short = item.displayId ?? item.id.slice(0, 8)
    if (action === 'cherryPick') {
      run({ kind: 'cherryPick', commit: item.id })
    } else if (action === 'checkoutRevision') {
      runConfirmed(
        { kind: 'checkoutRevision', commit: item.id },
        {
          title: translate('gitLog.checkoutRevision.title', 'Checkout revision {{value0}}?', {
            value0: short
          }),
          description: translate(
            'gitLog.checkoutRevision.description',
            'The worktree leaves its branch for a detached HEAD. Commits made there belong to no branch until you create one.'
          ),
          confirmLabel: translate('gitLog.checkoutRevision.confirm', 'Checkout')
        }
      )
    } else if (action === 'showRepository') {
      setRevisionTarget({ commitId: item.id, title: `${short} ${item.subject}` })
    } else if (action === 'compareWithLocal') {
      showDiff(
        workingTreeDiffTarget(
          context,
          item.id,
          translate('gitLog.compare.withLocal', '{{value0}} ↔ Local', { value0: short })
        )
      )
    } else if (action === 'newBranch') {
      askNewBranch(item.id, short, '')
    } else {
      setNameRequest({
        title: translate('gitLog.newTag.title', 'New Tag'),
        description: translate('gitLog.newTag.description', 'Tag commit {{value0}}.', {
          value0: short
        }),
        label: translate('gitLog.newTag.label', 'Tag name'),
        initialName: '',
        confirmLabel: translate('gitLog.newTag.create', 'Create'),
        messageLabel: translate('gitLog.newTag.message', 'Message (optional: makes it annotated)'),
        submit: ({ name, message }) =>
          submit({ kind: 'createTag', name, commit: item.id, ...(message ? { message } : {}) })
      })
    }
  }

  const deleteRef = (ref: GitRefEntry) => {
    if (ref.kind === 'remote') {
      const split = splitRemoteBranchName(ref.shortName)
      if (split) {
        runConfirmed(
          { kind: 'deleteRemoteBranch', remote: split.remoteName, branch: split.branchName },
          {
            title: translate('gitLog.deleteRemote.title', 'Delete {{value0}} on the remote?', {
              value0: ref.shortName
            }),
            description: translate(
              'gitLog.deleteRemote.description',
              'The branch is removed from {{value0}} for everyone who uses it.',
              { value0: split.remoteName }
            ),
            confirmLabel: translate('gitLog.delete.confirm', 'Delete'),
            confirmVariant: 'destructive'
          }
        )
      }
      return
    }
    runConfirmed(
      { kind: 'deleteBranch', name: ref.shortName, force: false },
      {
        title: translate('gitLog.delete.title', 'Delete branch {{value0}}?', {
          value0: ref.shortName
        }),
        description: translate(
          'gitLog.delete.description',
          'Only the branch name goes away; it can be recreated from its last commit {{value0}}.',
          { value0: ref.oid.slice(0, 8) }
        ),
        confirmLabel: translate('gitLog.delete.confirm', 'Delete'),
        confirmVariant: 'destructive'
      }
    )
  }

  const runBranchAction = (action: GitLogWriteBranchAction, ref: GitRefEntry) => {
    const name = ref.shortName
    if (action === 'checkout') {
      run({ kind: 'checkout', ref: { kind: ref.kind, name } })
    } else if (action === 'newBranch') {
      const remoteBranch = ref.kind === 'remote' ? splitRemoteBranchName(name)?.branchName : null
      askNewBranch(ref.oid, name, remoteBranch ?? '')
    } else if (action === 'checkoutAndRebase') {
      if (currentBranch) {
        run({ kind: 'checkoutAndRebase', branch: name, onto: currentBranch })
      }
    } else if (action === 'compare') {
      if (headOid) {
        showDiff(
          revisionsDiffTarget(
            context,
            headOid,
            ref.oid,
            `${currentBranch ?? headOid.slice(0, 8)} ↔ ${name}`
          )
        )
      }
    } else if (action === 'diffWorkingTree') {
      showDiff(
        workingTreeDiffTarget(
          context,
          ref.oid,
          translate('gitLog.compare.withLocal', '{{value0}} ↔ Local', { value0: name })
        )
      )
    } else if (action === 'rebaseOnto') {
      run({ kind: 'rebase', onto: name })
    } else if (action === 'merge') {
      run({ kind: 'merge', ref: name })
    } else if (action === 'update') {
      run({ kind: 'updateBranch', branch: name })
    } else if (action === 'push') {
      runConfirmed(
        { kind: 'pushBranch', branch: name },
        {
          title: translate('gitLog.push.title', 'Push {{value0}}?', { value0: name }),
          description: ref.upstream
            ? translate('gitLog.push.description', 'Its new commits go to {{value0}}.', {
                value0: ref.upstream.replace(/^refs\/remotes\//, '')
              })
            : translate(
                'gitLog.push.noUpstream',
                'It has no upstream yet: it is pushed to the remote and tracked from there.'
              ),
          confirmLabel: translate('gitLog.push.confirm', 'Push')
        }
      )
    } else if (action === 'rename') {
      setNameRequest({
        title: translate('gitLog.rename.title', 'Rename Branch'),
        description: translate('gitLog.rename.description', 'Rename {{value0}}.', { value0: name }),
        label: translate('gitLog.newBranch.label', 'Branch name'),
        initialName: name,
        confirmLabel: translate('gitLog.rename.confirm', 'Rename'),
        submit: ({ name: to }) => submit({ kind: 'renameBranch', from: name, to })
      })
    } else {
      deleteRef(ref)
    }
  }

  const isFavorite = useCallback(
    (ref: GitRefEntry) =>
      favorites.added.includes(ref.fullName) ||
      (!favorites.removed.includes(ref.fullName) && isGitLogFavoriteRef(ref)),
    [favorites]
  )
  const toggleFavorite = (ref: GitRefEntry) => {
    const without = (names: string[]) => names.filter((each) => each !== ref.fullName)
    const starredByDefault = isGitLogFavoriteRef(ref)
    const next: GitLogFavorites = isFavorite(ref)
      ? {
          added: without(favorites.added),
          removed: starredByDefault
            ? [...without(favorites.removed), ref.fullName]
            : favorites.removed
        }
      : {
          added: starredByDefault ? favorites.added : [...without(favorites.added), ref.fullName],
          removed: without(favorites.removed)
        }
    setFavorites(next)
    writeGitLogFavorites(repoId, next)
  }

  return {
    canWrite,
    busy: runner.busy,
    runCommitAction,
    runBranchAction,
    newBranchFromHead: () => {
      if (headOid) {
        askNewBranch(headOid, currentBranch ?? headOid.slice(0, 8), '')
      }
    },
    fetchAll: () => run({ kind: 'fetchAll' }),
    isFavorite,
    toggleFavorite,
    dialogs: (
      <>
        <GitLogNameDialog request={nameRequest} onClose={() => setNameRequest(null)} />
        <GitLogRevisionDialog
          target={revisionTarget}
          context={context}
          worktreePath={worktreePath}
          onClose={() => setRevisionTarget(null)}
        />
      </>
    )
  }
}
