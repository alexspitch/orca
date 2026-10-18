import React, { Suspense, createElement, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ChevronDown, ChevronRight, Folder, FolderOpen, Loader2, X } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import { getFileTypeIcon } from '@/lib/file-type-icons'
import { detectLanguage } from '@/lib/language-detect'
import { joinPath } from '@/lib/path'
import type { RuntimeGitContext } from '@/runtime/runtime-git-client-context'
import { errorMessage } from '../../../../shared/error-message'
import type { GitDiffResult } from '../../../../shared/git-diff-compare-types'
import { flattenSourceControlTree } from '../right-sidebar/source-control-tree'
import { buildGitLogCommitTree, type GitLogCommitTreeNode } from './git-log-commit-files'
import { loadFileAtRevision, loadTreeAtRevision } from './git-log-operations-client'
import { GitLogIconButton } from './GitLogIconButton'
import { GIT_LOG_DIFF_MODEL_PREFIX, disposeGitLogDiffModels } from './git-log-diff-models'

const DiffViewer = lazy(() => import('../editor/DiffViewer'))

const ROW_HEIGHT = 24
const INDENT_PX = 16

/** The commit whose files to browse, and how to title it. */
export type GitLogRevisionTarget = { commitId: string; title: string }

type Load<T> =
  | { status: 'loading' }
  | { status: 'ready'; value: T }
  | { status: 'error'; message: string }

function collectDirectoryKeys(
  nodes: readonly GitLogCommitTreeNode[],
  keys: string[] = []
): string[] {
  for (const node of nodes) {
    if (node.type === 'directory') {
      keys.push(node.key)
      collectDirectoryKeys(node.children, keys)
    }
  }
  return keys
}

function FileView({
  file,
  path,
  worktreePath,
  commitId
}: {
  file: Load<GitDiffResult> | null
  path: string | null
  worktreePath: string
  commitId: string
}): React.JSX.Element {
  const message = (text: string) => (
    <div className="flex flex-1 items-center justify-center gap-2 text-xs text-muted-foreground">
      {text}
    </div>
  )
  if (!path || !file) {
    return message(
      translate('gitLog.revision.pick', 'Pick a file to see it as it was in this commit.')
    )
  }
  if (file.status === 'loading') {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        {translate('gitLog.revision.loadingFile', 'Loading the file…')}
      </div>
    )
  }
  if (file.status === 'error') {
    return <div className="p-4 text-xs text-destructive">{file.message}</div>
  }
  if (file.value.kind === 'binary') {
    return message(translate('gitLog.revision.binary', 'Binary file: nothing to show as text.'))
  }
  const content = file.value.modifiedContent
  // Why a diff of the file with itself: Orca's Monaco viewer, read-only, with nothing marked.
  return (
    <Suspense fallback={null}>
      <DiffViewer
        modelKey={`${GIT_LOG_DIFF_MODEL_PREFIX}revision:${commitId}:${path}`}
        originalContent={content}
        modifiedContent={content}
        language={detectLanguage(path)}
        filePath={joinPath(worktreePath, path)}
        relativePath={path}
        sideBySide={false}
        largeDiffSaveContentAvailable={false}
      />
    </Suspense>
  )
}

/** WebStorm's Show Repository at Revision: the commit's whole tree, each file read-only. */
export function GitLogRevisionDialog({
  target,
  context,
  worktreePath,
  onClose
}: {
  target: GitLogRevisionTarget | null
  context: RuntimeGitContext
  worktreePath: string
  onClose: () => void
}): React.JSX.Element {
  const commitId = target?.commitId ?? null
  const [tree, setTree] = useState<Load<{ paths: string[]; truncated: boolean }>>({
    status: 'loading'
  })
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set())
  const [path, setPath] = useState<string | null>(null)
  const [file, setFile] = useState<Load<GitDiffResult> | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    disposeGitLogDiffModels()
    if (!commitId) {
      return
    }
    let stale = false
    setTree({ status: 'loading' })
    setOpened(new Set())
    setPath(null)
    setFile(null)
    loadTreeAtRevision(context, commitId).then(
      (value) => !stale && setTree({ status: 'ready', value }),
      (error: unknown) => !stale && setTree({ status: 'error', message: errorMessage(error) })
    )
    return () => {
      stale = true
    }
  }, [commitId, context])

  useEffect(() => {
    if (!commitId || !path) {
      return
    }
    let stale = false
    setFile({ status: 'loading' })
    loadFileAtRevision(context, commitId, path).then(
      (value) => !stale && setFile({ status: 'ready', value }),
      (error: unknown) => !stale && setFile({ status: 'error', message: errorMessage(error) })
    )
    return () => {
      stale = true
    }
  }, [commitId, context, path])

  const nodes = useMemo(
    () =>
      tree.status === 'ready'
        ? buildGitLogCommitTree(
            tree.value.paths.map((each) => ({ path: each, status: 'modified' as const }))
          )
        : [],
    [tree]
  )
  // Folders start closed: a big repository has thousands of files.
  const closed = useMemo(
    () => new Set(collectDirectoryKeys(nodes).filter((key) => !opened.has(key))),
    [nodes, opened]
  )
  const rows = useMemo(() => flattenSourceControlTree(nodes, closed), [closed, nodes])
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 16
  })
  const toggle = (key: string) =>
    setOpened((current) => {
      const next = new Set(current)
      if (!next.delete(key)) {
        next.add(key)
      }
      return next
    })

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="flex h-[calc(100vh-4rem)] flex-col sm:max-w-[calc(100vw-4rem)]"
      >
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="flex shrink-0 items-start gap-3">
            <div className="min-w-0 flex-1">
              <DialogTitle className="min-w-0">
                <span className="block truncate text-sm">
                  {translate('gitLog.revision.title', 'Repository at {{value0}}', {
                    value0: target?.title ?? ''
                  })}
                </span>
              </DialogTitle>
              {path ? (
                <div className="mt-1 truncate font-mono text-xs text-muted-foreground">{path}</div>
              ) : null}
            </div>
            <GitLogIconButton
              side="bottom"
              label={translate('gitLog.diff.close', 'Close')}
              icon={X}
              onClick={onClose}
            />
          </div>
          <div className="flex min-h-0 flex-1 gap-3">
            <div
              ref={scrollRef}
              role="tree"
              aria-label={translate('gitLog.revision.files', 'Files at this revision')}
              className="scrollbar-sleek w-80 shrink-0 overflow-auto rounded-md border py-1"
            >
              {tree.status === 'loading' ? (
                <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  {translate('gitLog.revision.loading', 'Loading files…')}
                </div>
              ) : tree.status === 'error' ? (
                <div className="px-3 py-2 text-xs text-destructive">{tree.message}</div>
              ) : (
                <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
                  {virtualizer.getVirtualItems().map((virtualRow) => {
                    const node = rows[virtualRow.index]!
                    const isDir = node.type === 'directory'
                    const open = isDir && !closed.has(node.key)
                    const selected = !isDir && node.path === path
                    return (
                      <div
                        key={node.key}
                        role="treeitem"
                        aria-expanded={isDir ? open : undefined}
                        aria-selected={selected}
                        onClick={() => (isDir ? toggle(node.key) : setPath(node.path))}
                        className={cn(
                          'absolute left-0 flex w-full cursor-default items-center gap-1 pr-3 text-[13px] whitespace-nowrap',
                          selected
                            ? 'bg-[color-mix(in_srgb,var(--foreground)_12%,var(--background))]'
                            : 'hover:bg-accent'
                        )}
                        style={{
                          top: virtualRow.start,
                          height: ROW_HEIGHT,
                          paddingLeft: 6 + node.depth * INDENT_PX
                        }}
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
                            className: 'size-3.5 shrink-0 text-muted-foreground'
                          })
                        )}
                        <span className="truncate">{node.name}</span>
                      </div>
                    )
                  })}
                </div>
              )}
              {tree.status === 'ready' && tree.value.truncated ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  {translate(
                    'gitLog.revision.truncated',
                    'Only the first 100,000 files are listed.'
                  )}
                </div>
              ) : null}
            </div>
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md border">
              {commitId ? (
                <FileView file={file} path={path} worktreePath={worktreePath} commitId={commitId} />
              ) : null}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
