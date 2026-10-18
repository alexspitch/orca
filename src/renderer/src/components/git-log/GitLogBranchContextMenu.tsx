import React from 'react'
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator
} from '@/components/ui/context-menu'
import { translate } from '@/i18n/i18n'
import type { GitRefEntry } from '../../../../shared/git-log-page-types'
import { gitLogBranchMenu, type GitLogBranchActionId } from './git-log-menus'
import { keyGitLogMenuEntries, type GitLogMenuEntry } from './git-log-menu-entries'

function branchActionLabel(action: GitLogBranchActionId, name: string, current: string): string {
  const labels: Record<GitLogBranchActionId, () => string> = {
    showInLog: () => translate('gitLog.branchMenu.showInLog', 'Show in Log'),
    checkout: () => translate('gitLog.branchMenu.checkout', 'Checkout'),
    newBranch: () =>
      translate('gitLog.branchMenu.newBranchFrom', "New Branch from '{{value0}}'…", {
        value0: name
      }),
    checkoutAndRebase: () =>
      translate('gitLog.branchMenu.checkoutRebase', "Checkout and Rebase onto '{{value0}}'", {
        value0: current
      }),
    compare: () =>
      translate('gitLog.branchMenu.compare', "Compare with '{{value0}}'", { value0: current }),
    diffWorkingTree: () =>
      translate('gitLog.branchMenu.diffWorkingTree', 'Show Diff with Working Tree'),
    rebaseOnto: () =>
      translate('gitLog.branchMenu.rebaseOnto', "Rebase '{{value0}}' onto '{{value1}}'", {
        value0: current,
        value1: name
      }),
    merge: () =>
      translate('gitLog.branchMenu.mergeInto', "Merge '{{value0}}' into '{{value1}}'", {
        value0: name,
        value1: current
      }),
    update: () => translate('gitLog.branchMenu.update', 'Update'),
    push: () => translate('gitLog.branchMenu.push', 'Push…'),
    rename: () => translate('gitLog.branchMenu.rename', 'Rename…'),
    delete: () => translate('gitLog.branchMenu.delete', 'Delete')
  }
  return labels[action]()
}

/** WebStorm's branch menu, in its order, with only what applies to this ref. */
export function GitLogBranchContextMenu({
  branch,
  currentBranch,
  canWrite,
  onSelect
}: {
  branch: GitRefEntry
  currentBranch: string | null
  canWrite: boolean
  onSelect: (action: GitLogBranchActionId) => void
}): React.JSX.Element {
  const current = currentBranch ?? 'HEAD'
  const entries: GitLogMenuEntry[] = gitLogBranchMenu(branch, currentBranch, canWrite).map(
    (action) =>
      action === 'separator'
        ? action
        : {
            label: branchActionLabel(action, branch.shortName, current),
            onSelect: () => onSelect(action),
            destructive: action === 'delete'
          }
  )
  return (
    <ContextMenuContent className="w-72">
      {keyGitLogMenuEntries(entries).map(({ key, entry }) =>
        entry === 'separator' ? (
          <ContextMenuSeparator key={key} />
        ) : (
          <ContextMenuItem
            key={key}
            variant={entry.destructive ? 'destructive' : 'default'}
            onSelect={entry.onSelect}
          >
            {entry.label}
          </ContextMenuItem>
        )
      )}
    </ContextMenuContent>
  )
}
