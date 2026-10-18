import { translate } from '@/i18n/i18n'
import type { GitLogOperation } from '../../../../shared/git-log-operation-types'
import type { GitLogOperationLabels } from './use-git-log-operation-runner'

const short = (commit: string) => commit.slice(0, 8)

/** What the toasts say while one operation runs and when it ends. */
export function gitLogOperationLabels(operation: GitLogOperation): GitLogOperationLabels {
  switch (operation.kind) {
    case 'checkout':
      return {
        pending: translate('gitLog.op.checkoutPending', 'Checking out {{value0}}…', {
          value0: operation.ref.name
        }),
        done: translate('gitLog.op.checkoutDone', 'Checked out {{value0}}', {
          value0: operation.ref.name
        }),
        failed: translate('gitLog.op.checkoutFailed', 'Checkout failed')
      }
    case 'checkoutRevision':
      return {
        pending: translate('gitLog.op.checkoutPending', 'Checking out {{value0}}…', {
          value0: short(operation.commit)
        }),
        done: translate('gitLog.op.checkoutDone', 'Checked out {{value0}}', {
          value0: short(operation.commit)
        }),
        failed: translate('gitLog.op.checkoutFailed', 'Checkout failed')
      }
    case 'createBranch':
      return {
        pending: translate('gitLog.op.createBranchPending', 'Creating branch {{value0}}…', {
          value0: operation.name
        }),
        done: translate('gitLog.op.createBranchDone', 'Created branch {{value0}}', {
          value0: operation.name
        }),
        failed: translate('gitLog.op.createBranchFailed', 'Couldn’t create the branch')
      }
    case 'renameBranch':
      return {
        pending: translate('gitLog.op.renamePending', 'Renaming {{value0}}…', {
          value0: operation.from
        }),
        done: translate('gitLog.op.renameDone', 'Renamed {{value0}} to {{value1}}', {
          value0: operation.from,
          value1: operation.to
        }),
        failed: translate('gitLog.op.renameFailed', 'Couldn’t rename the branch')
      }
    case 'deleteBranch':
      return {
        pending: translate('gitLog.op.deletePending', 'Deleting {{value0}}…', {
          value0: operation.name
        }),
        done: translate('gitLog.op.deleteDone', 'Deleted {{value0}}', { value0: operation.name }),
        failed: translate('gitLog.op.deleteFailed', 'Couldn’t delete the branch')
      }
    case 'deleteRemoteBranch': {
      const name = `${operation.remote}/${operation.branch}`
      return {
        pending: translate('gitLog.op.deletePending', 'Deleting {{value0}}…', { value0: name }),
        done: translate('gitLog.op.deleteDone', 'Deleted {{value0}}', { value0: name }),
        failed: translate('gitLog.op.deleteFailed', 'Couldn’t delete the branch')
      }
    }
    case 'merge':
      return {
        pending: translate('gitLog.op.mergePending', 'Merging {{value0}}…', {
          value0: operation.ref
        }),
        done: translate('gitLog.op.mergeDone', 'Merged {{value0}}', { value0: operation.ref }),
        failed: translate('gitLog.op.mergeFailed', 'Merge failed')
      }
    case 'rebase':
      return {
        pending: translate('gitLog.op.rebasePending', 'Rebasing onto {{value0}}…', {
          value0: operation.onto
        }),
        done: translate('gitLog.op.rebaseDone', 'Rebased onto {{value0}}', {
          value0: operation.onto
        }),
        failed: translate('gitLog.op.rebaseFailed', 'Rebase failed')
      }
    case 'checkoutAndRebase':
      return {
        pending: translate(
          'gitLog.op.rebaseBranchPending',
          'Rebasing {{value0}} onto {{value1}}…',
          {
            value0: operation.branch,
            value1: operation.onto
          }
        ),
        done: translate('gitLog.op.rebaseBranchDone', 'Rebased {{value0}} onto {{value1}}', {
          value0: operation.branch,
          value1: operation.onto
        }),
        failed: translate('gitLog.op.rebaseFailed', 'Rebase failed')
      }
    case 'updateBranch':
      return {
        pending: translate('gitLog.op.updatePending', 'Updating {{value0}}…', {
          value0: operation.branch
        }),
        done: translate('gitLog.op.updateDone', 'Updated {{value0}}', { value0: operation.branch }),
        failed: translate('gitLog.op.updateFailed', 'Update failed')
      }
    case 'pushBranch':
      return {
        pending: translate('gitLog.op.pushPending', 'Pushing {{value0}}…', {
          value0: operation.branch
        }),
        done: translate('gitLog.op.pushDone', 'Pushed {{value0}}', { value0: operation.branch }),
        failed: translate('gitLog.op.pushFailed', 'Push failed')
      }
    case 'fetchAll':
      return {
        pending: translate('gitLog.op.fetchPending', 'Fetching all remotes…'),
        done: translate('gitLog.op.fetchDone', 'Fetched all remotes'),
        failed: translate('gitLog.op.fetchFailed', 'Fetch failed')
      }
    case 'cherryPick':
      return {
        pending: translate('gitLog.op.cherryPickPending', 'Cherry-picking {{value0}}…', {
          value0: short(operation.commit)
        }),
        done: translate('gitLog.op.cherryPickDone', 'Cherry-picked {{value0}}', {
          value0: short(operation.commit)
        }),
        failed: translate('gitLog.op.cherryPickFailed', 'Cherry-pick failed')
      }
    case 'createTag':
      return {
        pending: translate('gitLog.op.createTagPending', 'Creating tag {{value0}}…', {
          value0: operation.name
        }),
        done: translate('gitLog.op.createTagDone', 'Created tag {{value0}}', {
          value0: operation.name
        }),
        failed: translate('gitLog.op.createTagFailed', 'Couldn’t create the tag')
      }
  }
}
