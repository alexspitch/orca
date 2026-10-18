import React from 'react'
import {
  ArrowDownLeft,
  ArrowDownToLine,
  ChevronLeft,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Crosshair,
  FolderTree,
  GitCompareArrows,
  Plus,
  Star,
  Trash2
} from 'lucide-react'
import { translate } from '@/i18n/i18n'
import type { GitRefEntry } from '../../../../shared/git-log-page-types'
import type { GitLogWriteBranchAction } from './use-git-log-actions'
import { GitLogIconButton } from './GitLogIconButton'

/**
 * The vertical toolbar beside WebStorm's branches tree. Its branch actions apply to the branch
 * picked in the tree; writing ones are left out when the host can't run them.
 */
export function GitLogIconStrip({
  branchesShown,
  onToggleBranches,
  groupByDirectory,
  onToggleGroupByDirectory,
  onExpandAll,
  onCollapseAll,
  selectedRef,
  currentBranch,
  canWrite,
  favorite,
  onNewBranch,
  onBranchAction,
  onFetch,
  onToggleFavorite,
  onNavigate
}: {
  branchesShown: boolean
  onToggleBranches: () => void
  groupByDirectory: boolean
  onToggleGroupByDirectory: () => void
  onExpandAll: () => void
  onCollapseAll: () => void
  selectedRef: GitRefEntry | null
  currentBranch: string | null
  canWrite: boolean
  favorite: boolean
  /** From the picked branch, or from HEAD when none is picked. */
  onNewBranch: () => void
  onBranchAction: (action: GitLogWriteBranchAction, ref: GitRefEntry) => void
  onFetch: () => void
  onToggleFavorite: () => void
  onNavigate: () => void
}): React.JSX.Element {
  const ref = selectedRef
  const isCurrent = ref?.kind === 'local' && ref.shortName === currentBranch
  const actOn = (action: GitLogWriteBranchAction) => () => ref && onBranchAction(action, ref)
  return (
    <nav
      aria-label={translate('gitLog.strip.label', 'Branches actions')}
      className="flex w-8 shrink-0 flex-col items-center gap-0.5 border-r py-1.5"
    >
      <GitLogIconButton
        side="right"
        label={
          branchesShown
            ? translate('gitLog.strip.hideBranches', 'Hide Branches')
            : translate('gitLog.strip.showBranches', 'Show Branches')
        }
        icon={branchesShown ? ChevronLeft : ChevronRight}
        onClick={onToggleBranches}
      />
      <div className="my-1 h-px w-4 bg-border" />
      {canWrite ? (
        <>
          <GitLogIconButton
            side="right"
            label={translate('gitLog.strip.newBranch', 'New Branch…')}
            icon={Plus}
            onClick={onNewBranch}
          />
          <GitLogIconButton
            side="right"
            label={translate('gitLog.strip.update', 'Update Selected')}
            icon={ArrowDownLeft}
            disabled={ref?.kind !== 'local'}
            onClick={actOn('update')}
          />
          <GitLogIconButton
            side="right"
            label={translate('gitLog.strip.delete', 'Delete Branch')}
            icon={Trash2}
            disabled={!ref || ref.kind === 'tag' || isCurrent}
            onClick={actOn('delete')}
          />
          <GitLogIconButton
            side="right"
            label={translate('gitLog.strip.compare', 'Compare with Current')}
            icon={GitCompareArrows}
            disabled={!ref || isCurrent}
            onClick={actOn('compare')}
          />
          <GitLogIconButton
            side="right"
            label={translate('gitLog.strip.fetch', 'Fetch All Remotes')}
            icon={ArrowDownToLine}
            onClick={onFetch}
          />
        </>
      ) : null}
      <GitLogIconButton
        side="right"
        label={translate('gitLog.strip.favorite', 'Mark/Unmark as Favorite')}
        icon={Star}
        disabled={!ref}
        pressed={favorite}
        onClick={onToggleFavorite}
      />
      <GitLogIconButton
        side="right"
        label={translate('gitLog.strip.navigate', 'Navigate Log to Selected Branch Head')}
        icon={Crosshair}
        disabled={!ref}
        onClick={onNavigate}
      />
      <div className="my-1 h-px w-4 bg-border" />
      <GitLogIconButton
        side="right"
        label={translate('gitLog.strip.groupByDirectory', 'Group by Directory')}
        icon={FolderTree}
        pressed={groupByDirectory}
        onClick={onToggleGroupByDirectory}
      />
      <GitLogIconButton
        side="right"
        label={translate('gitLog.tree.expandAll', 'Expand All')}
        icon={ChevronsUpDown}
        onClick={onExpandAll}
      />
      <GitLogIconButton
        side="right"
        label={translate('gitLog.tree.collapseAll', 'Collapse All')}
        icon={ChevronsDownUp}
        onClick={onCollapseAll}
      />
    </nav>
  )
}
