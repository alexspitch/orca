import React from 'react'
import {
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  Folder,
  FolderOpen,
  Minus,
  Plus,
  Trash,
  Undo2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { basename } from '@/lib/path'
import { useMaterialFileIcon } from '@/lib/material-icons/use-material-file-icons'
import { MaterialRowIcon } from '@/lib/material-icons/material-row-icon'
import { translate } from '@/i18n/i18n'
import type { DiscardAllArea } from '../commit/discard-all-sequence'
import type {
  BranchSourceControlTreeDirectoryNode,
  SourceControlDirectoryActionPaths,
  SourceControlTreeDirectoryNode
} from './directory-action-paths'
import { ActionButton } from './action-button'
import {
  collectSourceControlTreeDirectoryKeys,
  sectionTreeDirectoryKeys
} from '../../source-control-tree-directory-keys'
import {
  SOURCE_CONTROL_ROW_ACTION_OVERLAY_CLASS,
  SOURCE_CONTROL_TREE_DIRECTORY_PADDING_PX,
  SOURCE_CONTROL_TREE_INDENT_PX
} from './row-layout'

export type SourceControlFolderCollapse = {
  collapsedTreeDirs: ReadonlySet<string>
  setTreeDirsCollapsed: (keys: readonly string[], collapsed: boolean) => void
}

type FolderNode = Pick<SourceControlTreeDirectoryNode, 'key' | 'depth' | 'name' | 'fileCount'> & {
  children: readonly { type: string; key: string; depth: number }[]
}

/** Collapses a folder's subfolders; once any is closed, opens the folder and everything below. */
function SubfoldersToggleButton({
  node,
  below,
  folders
}: {
  node: FolderNode
  /** Keys of the folders under `node`. */
  below: readonly string[]
  folders: SourceControlFolderCollapse
}): React.JSX.Element | null {
  if (below.length === 0) {
    return null
  }
  const anyClosed = [node.key, ...below].some((key) => folders.collapsedTreeDirs.has(key))
  return (
    <ActionButton
      icon={anyClosed ? ChevronsUpDown : ChevronsDownUp}
      title={
        anyClosed
          ? translate(
              'auto.components.right.sidebar.SourceControl.expandSubfolders',
              'Expand subfolders'
            )
          : translate(
              'auto.components.right.sidebar.SourceControl.collapseSubfolders',
              'Collapse subfolders'
            )
      }
      onClick={(event) => {
        event.stopPropagation()
        if (anyClosed) {
          folders.setTreeDirsCollapsed([node.key, ...below], false)
        } else {
          folders.setTreeDirsCollapsed(below, true)
        }
      }}
    />
  )
}

/** A section header's «collapse/expand all folders»; null outside tree view or without folders. */
export function SectionFoldersToggleButton({
  rows,
  folders
}: {
  rows: readonly { type: string; key: string; depth: number }[]
  folders: SourceControlFolderCollapse
}): React.JSX.Element | null {
  const keys = sectionTreeDirectoryKeys(rows)
  if (keys.length === 0) {
    return null
  }
  const anyClosed = keys.some((key) => folders.collapsedTreeDirs.has(key))
  return (
    <ActionButton
      icon={anyClosed ? ChevronsUpDown : ChevronsDownUp}
      title={
        anyClosed
          ? translate(
              'auto.components.right.sidebar.SourceControl.expandAllFolders',
              'Expand all folders'
            )
          : translate(
              'auto.components.right.sidebar.SourceControl.collapseAllFolders',
              'Collapse all folders'
            )
      }
      onClick={(event) => {
        event.stopPropagation()
        folders.setTreeDirsCollapsed(keys, !anyClosed)
      }}
    />
  )
}

/** Shared chrome for both directory rows: indentation, collapse toggle, folder icon, name, file count. */
function SourceControlTreeDirectoryHeader({
  node,
  isCollapsed,
  onToggle,
  folders,
  hasActions = false,
  children
}: {
  node: FolderNode
  isCollapsed: boolean
  onToggle: () => void
  folders: SourceControlFolderCollapse
  hasActions?: boolean
  children?: React.ReactNode
}): React.JSX.Element {
  const below = collectSourceControlTreeDirectoryKeys(node.children)
  // Why Alt: the tree convention (VS Code, JetBrains) for opening or closing a folder with all below it.
  const toggleSubtree = () => folders.setTreeDirsCollapsed([node.key, ...below], !isCollapsed)
  // Why basename: a compacted row (`src/lib`) takes its icon from its deepest folder, as in VS Code.
  const materialIcon = useMaterialFileIcon(
    basename(node.name),
    isCollapsed ? 'folder' : 'folder-open'
  )
  return (
    <div
      className="group relative flex w-full items-center gap-1 pr-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground"
      style={{
        paddingLeft: `${node.depth * SOURCE_CONTROL_TREE_INDENT_PX + SOURCE_CONTROL_TREE_DIRECTORY_PADDING_PX}px`
      }}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-1 text-left"
        onClick={(event) => (event.altKey ? toggleSubtree() : onToggle())}
        aria-expanded={!isCollapsed}
      >
        <ChevronDown
          className={cn('size-3 shrink-0 transition-transform', isCollapsed && '-rotate-90')}
        />
        {materialIcon ? (
          <MaterialRowIcon url={materialIcon} />
        ) : isCollapsed ? (
          <Folder className="size-3 shrink-0" />
        ) : (
          <FolderOpen className="size-3 shrink-0" />
        )}
        <span className="min-w-0 flex-1 truncate">{node.name}</span>
      </button>
      <span className="w-4 shrink-0 text-center text-[10px] font-bold tabular-nums text-muted-foreground/80">
        {node.fileCount}
      </span>
      {below.length > 0 || hasActions ? (
        <div className={SOURCE_CONTROL_ROW_ACTION_OVERLAY_CLASS}>
          <SubfoldersToggleButton node={node} below={below} folders={folders} />
          {children}
        </div>
      ) : null}
    </div>
  )
}

/**
 * Working-tree directory row. `actionPaths` must already be scoped to the currently visible
 * descendants, and bulk actions only render when that scope is non-empty.
 */
export function SourceControlTreeDirectoryRow({
  node,
  actionPaths,
  hideBulkActions,
  isExecutingBulk,
  isCollapsed,
  onToggle,
  folders,
  onRequestDiscardPaths,
  onStagePaths,
  onUnstagePaths
}: {
  node: SourceControlTreeDirectoryNode
  actionPaths: SourceControlDirectoryActionPaths
  hideBulkActions: boolean
  isExecutingBulk: boolean
  isCollapsed: boolean
  onToggle: () => void
  folders: SourceControlFolderCollapse
  onRequestDiscardPaths: (area: DiscardAllArea, paths: readonly string[]) => void
  onStagePaths: (paths: readonly string[]) => Promise<void>
  onUnstagePaths: (paths: readonly string[]) => Promise<void>
}): React.JSX.Element {
  // Why: filtered tree nodes only contain visible descendants, so folder-wide bulk labels would overpromise on the subset.
  const canStage = !hideBulkActions && actionPaths.stagePaths.length > 0
  const canUnstage = !hideBulkActions && actionPaths.unstagePaths.length > 0
  const canDiscard = !hideBulkActions && actionPaths.discardPaths.length > 0

  return (
    <SourceControlTreeDirectoryHeader
      node={node}
      isCollapsed={isCollapsed}
      onToggle={onToggle}
      folders={folders}
      hasActions={canDiscard || canStage || canUnstage}
    >
      {canDiscard && (
        <ActionButton
          icon={node.area === 'untracked' ? Trash : Undo2}
          title={
            node.area === 'untracked'
              ? translate(
                  'auto.components.right.sidebar.SourceControl.9b367363b6',
                  'Delete untracked in folder'
                )
              : translate(
                  'auto.components.right.sidebar.SourceControl.6d7f2a47e5',
                  'Discard folder'
                )
          }
          onClick={(event) => {
            event.stopPropagation()
            onRequestDiscardPaths(node.area, actionPaths.discardPaths)
          }}
          disabled={isExecutingBulk}
        />
      )}
      {canStage && (
        <ActionButton
          icon={Plus}
          title={translate(
            'auto.components.right.sidebar.SourceControl.bfe9011a0e',
            'Stage folder'
          )}
          onClick={(event) => {
            event.stopPropagation()
            void onStagePaths(actionPaths.stagePaths)
          }}
          disabled={isExecutingBulk}
        />
      )}
      {canUnstage && (
        <ActionButton
          icon={Minus}
          title={translate(
            'auto.components.right.sidebar.SourceControl.ab31221779',
            'Unstage folder'
          )}
          onClick={(event) => {
            event.stopPropagation()
            void onUnstagePaths(actionPaths.unstagePaths)
          }}
          disabled={isExecutingBulk}
        />
      )}
    </SourceControlTreeDirectoryHeader>
  )
}

/** Branch-compare directory row: read-only, so it deliberately exposes no stage/discard actions. */
export function SourceControlBranchTreeDirectoryRow({
  node,
  isCollapsed,
  onToggle,
  folders
}: {
  node: BranchSourceControlTreeDirectoryNode
  isCollapsed: boolean
  onToggle: () => void
  folders: SourceControlFolderCollapse
}): React.JSX.Element {
  return (
    <SourceControlTreeDirectoryHeader
      node={node}
      isCollapsed={isCollapsed}
      onToggle={onToggle}
      folders={folders}
    />
  )
}
