import React, { createElement, useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Folder,
  FolderOpen,
  GitCompareArrows,
  Loader2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import { getFileTypeIcon } from '@/lib/file-type-icons'
import type { GitHistoryItem } from '../../../../shared/git-history'
import type { GitBranchChangeEntry } from '../../../../shared/git-diff-compare-types'
import { flattenSourceControlTree } from '../right-sidebar/source-control-tree'
import { STATUS_COLORS } from '../right-sidebar/status-display'
import { GitLogIconButton } from './GitLogIconButton'
import {
  buildGitLogCommitTree,
  gitLogFilesInTreeOrder,
  type GitLogCommitTreeNode
} from './git-log-commit-files'

type TreeNode = GitLogCommitTreeNode
type FilesState =
  | { status: 'idle' | 'loading' }
  | { status: 'ready'; entries: GitBranchChangeEntry[] }
  | { status: 'error'; message: string }

const ROOT_KEY = 'commit-root'
const INDENT_PX = 16

function filesLabel(count: number): string {
  return count === 1
    ? translate('gitLog.changes.oneFile', '1 file')
    : translate('gitLog.changes.files', '{{value0}} files', { value0: count })
}

function collectDirectoryKeys(nodes: readonly TreeNode[], keys: string[] = []): string[] {
  for (const node of nodes) {
    if (node.type === 'directory') {
      keys.push(node.key)
      collectDirectoryKeys(node.children, keys)
    }
  }
  return keys
}

type GitLogChangesPaneProps = {
  item: GitHistoryItem | null
  loadCommitFiles: (item: GitHistoryItem) => Promise<GitBranchChangeEntry[]>
  /** Opens the diff of `index` among `files`, the commit's files in the tree's order. */
  onShowDiff: (item: GitHistoryItem, files: GitBranchChangeEntry[], index: number) => void
  /** The selected file's path, kept by the page so it survives reopening. */
  selectedPath: string | null
  onSelectPath: (path: string) => void
}

/** The selected commit's changed files as a tree under an "N files" root, as WebStorm shows them. */
export function GitLogChangesPane({
  item,
  loadCommitFiles,
  onShowDiff,
  selectedPath,
  onSelectPath
}: GitLogChangesPaneProps): React.JSX.Element {
  const [files, setFiles] = useState<FilesState>({ status: 'idle' })
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set())

  // Why keyed by id: a log reload hands out new objects for the same commit; keep the tree state.
  const itemRef = useRef(item)
  itemRef.current = item
  const itemId = item?.id ?? null
  useEffect(() => {
    const current = itemRef.current
    if (!current) {
      setFiles({ status: 'idle' })
      return
    }
    let stale = false
    setFiles({ status: 'loading' })
    setCollapsed(new Set())
    loadCommitFiles(current).then(
      (entries) => !stale && setFiles({ status: 'ready', entries }),
      (error: unknown) =>
        !stale &&
        setFiles({
          status: 'error',
          message: error instanceof Error ? error.message : String(error)
        })
    )
    return () => {
      stale = true
    }
  }, [itemId, loadCommitFiles])

  const tree = useMemo((): TreeNode[] => {
    if (files.status !== 'ready') {
      return []
    }
    const children = buildGitLogCommitTree(files.entries).map((node) => shiftDepth(node, 1))
    return [
      {
        type: 'directory',
        key: ROOT_KEY,
        name: filesLabel(files.entries.length),
        path: '',
        area: 'commit',
        depth: 0,
        fileCount: files.entries.length,
        children
      }
    ]
  }, [files])
  const rows = useMemo(() => flattenSourceControlTree(tree, collapsed), [collapsed, tree])
  const orderedFiles = useMemo(() => gitLogFilesInTreeOrder(tree), [tree])
  const showDiff = (path: string | null) => {
    if (!item || orderedFiles.length === 0) {
      return
    }
    const index = path ? orderedFiles.findIndex((entry) => entry.path === path) : -1
    onShowDiff(item, orderedFiles, Math.max(0, index))
  }
  // Why: a file restored from the last visit may sit below the fold once the tree loads.
  const selectedRowRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    selectedRowRef.current?.scrollIntoView({ block: 'nearest' })
  }, [files.status, selectedPath])

  const toggle = (key: string) =>
    setCollapsed((current) => {
      const next = new Set(current)
      if (!next.delete(key)) {
        next.add(key)
      }
      return next
    })

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-9 shrink-0 items-center gap-0.5 border-b px-1.5">
        <GitLogIconButton
          label={translate('gitLog.changes.showDiff', 'Show Diff')}
          icon={GitCompareArrows}
          onClick={() => showDiff(selectedPath)}
        />
        <div className="flex-1" />
        <GitLogIconButton
          label={translate('gitLog.tree.expandAll', 'Expand All')}
          icon={ChevronsUpDown}
          onClick={() => setCollapsed(new Set())}
        />
        <GitLogIconButton
          label={translate('gitLog.tree.collapseAll', 'Collapse All')}
          icon={ChevronsDownUp}
          onClick={() =>
            setCollapsed(new Set(collectDirectoryKeys(tree).filter((key) => key !== ROOT_KEY)))
          }
        />
      </div>
      <div
        role="tree"
        aria-label={translate('gitLog.changes.label', 'Changed files')}
        className="scrollbar-sleek min-h-0 flex-1 overflow-auto py-1"
      >
        {files.status === 'loading' ? (
          <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            {translate('gitLog.changes.loading', 'Loading changes…')}
          </div>
        ) : files.status === 'error' ? (
          <div className="px-3 py-2 text-xs text-destructive">{files.message}</div>
        ) : (
          rows.map((node) => {
            const isDir = node.type === 'directory'
            const open = isDir && !collapsed.has(node.key)
            const color = isDir ? undefined : STATUS_COLORS[node.entry.status]
            const selected = !isDir && node.path === selectedPath
            return (
              <div
                key={node.key}
                ref={selected ? selectedRowRef : undefined}
                role="treeitem"
                aria-expanded={isDir ? open : undefined}
                aria-selected={selected}
                tabIndex={-1}
                onClick={() => {
                  if (isDir) {
                    toggle(node.key)
                    return
                  }
                  onSelectPath(node.path)
                  showDiff(node.path)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !isDir) {
                    showDiff(node.path)
                  }
                }}
                className={cn(
                  'flex h-6 cursor-default items-center gap-1 pr-3 text-[13px] whitespace-nowrap',
                  selected
                    ? 'bg-[color-mix(in_srgb,var(--foreground)_12%,var(--background))]'
                    : 'hover:bg-accent'
                )}
                style={{ paddingLeft: 6 + node.depth * INDENT_PX }}
                title={isDir ? undefined : node.path}
              >
                <span className="flex size-4 shrink-0 items-center justify-center text-muted-foreground">
                  {isDir ? (
                    open ? (
                      <ChevronDown className="size-3.5" />
                    ) : (
                      <ChevronRight className="size-3.5" />
                    )
                  ) : null}
                </span>
                {isDir ? (
                  open ? (
                    <FolderOpen className="size-3.5 shrink-0 text-muted-foreground" />
                  ) : (
                    <Folder className="size-3.5 shrink-0 text-muted-foreground" />
                  )
                ) : (
                  createElement(getFileTypeIcon(node.path), {
                    className: 'size-3.5 shrink-0',
                    style: { color }
                  })
                )}
                <span className="truncate" style={{ color }}>
                  {node.name}
                </span>
                {isDir && node.key !== ROOT_KEY ? (
                  <span className="pl-1 text-xs text-muted-foreground">
                    {filesLabel(node.fileCount)}
                  </span>
                ) : null}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

function shiftDepth(node: TreeNode, by: number): TreeNode {
  return node.type === 'file'
    ? { ...node, depth: node.depth + by }
    : {
        ...node,
        depth: node.depth + by,
        children: node.children.map((child) => shiftDepth(child, by))
      }
}
