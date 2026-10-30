import { useMemo, useState } from 'react'
import { ChevronDown, Folder, FolderOpen } from 'lucide-react'
import { FileTypeIcon } from '@/components/FileTypeIcon'
import { flattenSourceControlTree } from '@/components/right-sidebar/source-control-tree'
import { STATUS_COLORS } from '@/components/right-sidebar/status-display'
import { cn } from '@/lib/utils'
import type { DiffFile } from './commit-diff-rows'
import type { CommitFileNode } from './commit-file-tree'

// Same steps as the combined diff's tree, so both read alike.
const INDENT_PX = 12
const FOLDER_PADDING_PX = 8
const FILE_PADDING_PX = 20

const STATUS_COLOR: Record<DiffFile['status'], string> = {
  added: STATUS_COLORS.added,
  deleted: STATUS_COLORS.deleted,
  changed: STATUS_COLORS.modified
}

/** The commit's files as folders; a folder folds away on a click. Mount per commit. */
export function CommitFileTree({
  roots,
  selected,
  onSelect
}: {
  roots: CommitFileNode[]
  selected: number | null
  onSelect: (index: number) => void
}): React.JSX.Element {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set())
  const rows = useMemo(() => flattenSourceControlTree(roots, collapsed), [roots, collapsed])
  const toggle = (key: string) =>
    setCollapsed((shown) => {
      const next = new Set(shown)
      if (!next.delete(key)) {
        next.add(key)
      }
      return next
    })

  return (
    <div className="scrollbar-sleek max-h-72 overflow-y-auto border-b border-border py-1">
      {rows.map((node) =>
        node.type === 'directory' ? (
          <button
            key={node.key}
            type="button"
            onClick={() => toggle(node.key)}
            aria-expanded={!collapsed.has(node.key)}
            title={node.path}
            className="flex w-full min-w-0 items-center gap-1 py-1 pr-3 text-left text-xs text-muted-foreground hover:bg-accent/40 hover:text-foreground"
            style={{ paddingLeft: node.depth * INDENT_PX + FOLDER_PADDING_PX }}
          >
            <ChevronDown
              className={cn(
                'size-3 shrink-0 transition-transform',
                collapsed.has(node.key) && '-rotate-90'
              )}
            />
            {collapsed.has(node.key) ? (
              <Folder className="size-3 shrink-0" />
            ) : (
              <FolderOpen className="size-3 shrink-0" />
            )}
            <span className="min-w-0 flex-1 truncate">{node.name}</span>
            <span className="shrink-0 text-[10px] font-bold tabular-nums text-muted-foreground/80">
              {node.fileCount}
            </span>
          </button>
        ) : (
          <button
            key={node.key}
            type="button"
            onClick={() => onSelect(node.entry.index)}
            aria-pressed={node.entry.index === selected}
            title={node.path}
            className={cn(
              'flex w-full min-w-0 items-center gap-1 py-1 pr-3 text-left text-xs hover:bg-accent/40',
              node.entry.index === selected && 'bg-accent/60'
            )}
            style={{ paddingLeft: node.depth * INDENT_PX + FILE_PADDING_PX }}
          >
            <FileTypeIcon
              filePath={node.path}
              className="size-3.5 shrink-0"
              style={{ color: STATUS_COLOR[node.entry.file.status] }}
            />
            <span className="min-w-0 flex-1 truncate">{node.name}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              +{node.entry.file.added} −{node.entry.file.removed}
            </span>
          </button>
        )
      )}
    </div>
  )
}
