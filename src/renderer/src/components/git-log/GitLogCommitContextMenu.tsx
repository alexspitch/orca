import React from 'react'
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut
} from '@/components/ui/context-menu'
import { translate } from '@/i18n/i18n'
import type { GitHistoryItem } from '../../../../shared/git-history'
import { gitLogCommitMenu, type GitLogCommitActionId } from './git-log-menus'
import { keyGitLogMenuEntries, type GitLogMenuEntry } from './git-log-menu-entries'

function commitActionLabel(action: GitLogCommitActionId, short: string): string {
  const labels: Record<GitLogCommitActionId, () => string> = {
    copyRevision: () => translate('gitLog.commitMenu.copyRevision', 'Copy Revision Number'),
    cherryPick: () => translate('gitLog.commitMenu.cherryPick', 'Cherry-Pick'),
    checkoutRevision: () =>
      translate('gitLog.commitMenu.checkoutRevision', "Checkout Revision '{{value0}}'", {
        value0: short
      }),
    showRepository: () =>
      translate('gitLog.commitMenu.showRepository', 'Show Repository at Revision'),
    compareWithLocal: () => translate('gitLog.commitMenu.compareLocal', 'Compare with Local'),
    newBranch: () => translate('gitLog.commitMenu.newBranch', 'New Branch…'),
    newTag: () => translate('gitLog.commitMenu.newTag', 'New Tag…'),
    child: () => translate('gitLog.commitMenu.child', 'Go to Child Commit'),
    parent: () => translate('gitLog.commitMenu.parent', 'Go to Parent Commit'),
    openInBrowser: () => translate('gitLog.commitMenu.openInBrowser', 'Open in Browser'),
    explain: () => translate('gitLog.commitMenu.explain', 'Explain Changes')
  }
  return labels[action]()
}

/** WebStorm's Log menu for a commit, in its order, with only the items that work. */
export function GitLogCommitContextMenu({
  item,
  canWrite,
  onSelect,
  childId,
  parentId
}: {
  item: GitHistoryItem
  canWrite: boolean
  onSelect: (action: GitLogCommitActionId) => void
  /** The loaded child and parent; null disables the matching item. */
  childId: string | null
  parentId: string | null
}): React.JSX.Element {
  const short = item.displayId ?? item.id.slice(0, 8)
  const entries: GitLogMenuEntry[] = gitLogCommitMenu(canWrite).map((action) => {
    if (action === 'separator') {
      return action
    }
    const unreachable = (action === 'child' && !childId) || (action === 'parent' && !parentId)
    return {
      label: commitActionLabel(action, short),
      onSelect: unreachable ? undefined : () => onSelect(action),
      shortcut: action === 'child' ? '←' : action === 'parent' ? '→' : undefined
    }
  })
  return (
    <ContextMenuContent className="w-64">
      {keyGitLogMenuEntries(entries).map(({ key, entry }) =>
        entry === 'separator' ? (
          <ContextMenuSeparator key={key} />
        ) : (
          <ContextMenuItem key={key} disabled={!entry.onSelect} onSelect={entry.onSelect}>
            {entry.label}
            {entry.shortcut ? <ContextMenuShortcut>{entry.shortcut}</ContextMenuShortcut> : null}
          </ContextMenuItem>
        )
      )}
    </ContextMenuContent>
  )
}
