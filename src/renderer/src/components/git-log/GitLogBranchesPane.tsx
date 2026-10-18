import React, { useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ChevronDown, ChevronRight, Loader2, Search, Star, Tag } from 'lucide-react'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu'
import type { GitRefEntry, GitRefsResult } from '../../../../shared/git-log-page-types'
import { buildGitLogBranchRows, type GitLogBranchRow } from './git-log-branch-tree'
import type { GitLogBranchActionId } from './git-log-menus'
import { GitLogBranchContextMenu } from './GitLogBranchContextMenu'
import type { GitLogUnsupportedReason } from './git-log-client'

const ROW_HEIGHT = 24
const INDENT_PX = 16

type GitLogBranchesPaneProps = {
  refs: GitRefsResult | null
  loading: boolean
  error: string | null
  /** Set when the host predates the Git page and lists no refs, and why. */
  unsupported: GitLogUnsupportedReason | null
  activeRef: string | null
  onFilterRef: (ref: string | null) => void
  groupByDirectory: boolean
  toggled: ReadonlySet<string>
  onToggle: (key: string) => void
  currentBranch: string | null
  canWrite: boolean
  /** Menu actions other than Show in Log, which filters the log here. */
  onBranchAction: (action: Exclude<GitLogBranchActionId, 'showInLog'>, ref: GitRefEntry) => void
  isFavorite: (ref: GitRefEntry) => boolean
}

function BranchRowContent({ row }: { row: GitLogBranchRow }): React.JSX.Element {
  if (row.kind === 'group') {
    return (
      <>
        <span className="flex size-4 shrink-0 items-center justify-center text-muted-foreground">
          {row.expanded ? (
            <ChevronDown className="size-3.5" />
          ) : (
            <ChevronRight className="size-3.5" />
          )}
        </span>
        <span className="truncate">{row.label}</span>
      </>
    )
  }
  if (row.kind === 'head') {
    return <span className="truncate pl-5">{row.label}</span>
  }
  return (
    <>
      <span className="size-4 shrink-0" />
      <Tag
        className={cn(
          'size-3.5 shrink-0',
          row.isCurrent ? 'text-git-graph-ref' : 'text-muted-foreground'
        )}
      />
      <span className={cn('truncate', row.isCurrent && 'font-semibold')}>{row.label}</span>
      {row.isFavorite ? (
        <Star
          aria-label={translate('gitLog.branches.favorite', 'Favorite')}
          className="size-3 shrink-0 fill-current text-muted-foreground"
        />
      ) : null}
    </>
  )
}

/** WebStorm's branches tree: HEAD, Local, Remote › remote › folders, Tags. Click filters the log. */
export function GitLogBranchesPane({
  refs,
  loading,
  error,
  unsupported,
  activeRef,
  onFilterRef,
  groupByDirectory,
  toggled,
  onToggle,
  currentBranch,
  canWrite,
  onBranchAction,
  isFavorite
}: GitLogBranchesPaneProps): React.JSX.Element {
  const [query, setQuery] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const rows = useMemo(
    () =>
      buildGitLogBranchRows(refs?.refs ?? [], {
        headLabel: translate('gitLog.branches.head', 'HEAD (Current Branch)'),
        sectionLabels: {
          local: translate('gitLog.branches.local', 'Local'),
          remote: translate('gitLog.branches.remote', 'Remote'),
          tag: translate('gitLog.branches.tags', 'Tags')
        },
        query,
        groupByDirectory,
        toggled,
        isFavorite
      }),
    [groupByDirectory, isFavorite, query, refs, toggled]
  )
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 16
  })

  const notices: Record<GitLogUnsupportedReason, () => string> = {
    'outdated-app': () => translate('gitLog.branches.restartApp', 'Restart Orca to list branches.'),
    'outdated-server': () =>
      translate('gitLog.branches.updateServer', 'Update the Orca server to list branches.'),
    ssh: () =>
      translate(
        'gitLog.branches.ssh',
        'Branches of a project on an SSH host aren’t listed here yet.'
      )
  }
  const notice = unsupported ? notices[unsupported]() : error
  return (
    <section
      aria-label={translate('gitLog.branches.label', 'Branches')}
      className="flex min-h-0 flex-1 flex-col"
    >
      <label className="mx-1.5 mt-1.5 mb-1 flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-input px-2 text-muted-foreground focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
        <Search className="size-3.5 shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={translate('gitLog.branches.search', 'Branch or tag')}
          aria-label={translate('gitLog.branches.search', 'Branch or tag')}
          className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
        />
      </label>
      {notice ? <div className="px-3 py-2 text-xs text-muted-foreground">{notice}</div> : null}
      {loading && !refs ? (
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          {translate('gitLog.branches.loading', 'Loading branches…')}
        </div>
      ) : null}
      <div ref={scrollRef} role="tree" className="scrollbar-sleek min-h-0 flex-1 overflow-auto">
        <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index]!
            const filterRef = row.kind === 'group' ? null : row.filterRef
            const selected = filterRef !== null && filterRef === activeRef
            const element = (
              <div
                role="treeitem"
                aria-expanded={row.kind === 'group' ? row.expanded : undefined}
                aria-selected={selected}
                onClick={() =>
                  row.kind === 'group'
                    ? onToggle(row.key)
                    : onFilterRef(selected ? null : filterRef)
                }
                className={cn(
                  'absolute left-0 flex w-full cursor-default items-center gap-1 pr-2 text-[13px] whitespace-nowrap',
                  selected
                    ? 'bg-[color-mix(in_srgb,var(--foreground)_12%,var(--background))]'
                    : 'hover:bg-accent'
                )}
                style={{
                  top: virtualRow.start,
                  height: ROW_HEIGHT,
                  paddingLeft: 4 + row.depth * INDENT_PX
                }}
              >
                <BranchRowContent row={row} />
              </div>
            )
            return row.kind === 'branch' ? (
              <ContextMenu key={row.key}>
                <ContextMenuTrigger asChild>{element}</ContextMenuTrigger>
                <GitLogBranchContextMenu
                  branch={row.ref}
                  currentBranch={currentBranch}
                  canWrite={canWrite}
                  onSelect={(action) =>
                    action === 'showInLog'
                      ? onFilterRef(row.filterRef)
                      : onBranchAction(action, row.ref)
                  }
                />
              </ContextMenu>
            ) : (
              <React.Fragment key={row.key}>{element}</React.Fragment>
            )
          })}
        </div>
      </div>
    </section>
  )
}
