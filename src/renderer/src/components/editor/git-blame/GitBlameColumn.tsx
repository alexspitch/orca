import { useEffect, useState } from 'react'
import * as monaco from 'monaco-editor'
import type { editor } from 'monaco-editor'
import { Loader2 } from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { isUncommittedBlameSha, type GitBlameCommit } from '../../../../../shared/git-blame'
import { hideEditorGitBlame, openGitBlameCommit } from './editor-git-blame-actions'
import { useEditorGitBlame } from './editor-git-blame-store'
import { useMonacoGitBlameLines } from './use-monaco-git-blame-lines'

const blameDate = (seconds: number): string =>
  new Date(seconds * 1000).toLocaleDateString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })

/** Re-renders whenever the editor's visible lines or their positions change. */
function useEditorViewport(mountedEditor: editor.IStandaloneCodeEditor | null): void {
  const [, setVersion] = useState(0)
  useEffect(() => {
    if (!mountedEditor) {
      return
    }
    const bump = () => setVersion((v) => v + 1)
    const subscriptions = [
      mountedEditor.onDidScrollChange(bump),
      mountedEditor.onDidLayoutChange(bump),
      mountedEditor.onDidChangeHiddenAreas(bump),
      mountedEditor.onDidChangeConfiguration(bump)
    ]
    return () => subscriptions.forEach((s) => s.dispose())
  }, [mountedEditor])
}

function BlameCommitCard({ commit }: { commit: GitBlameCommit }): React.JSX.Element {
  return (
    <div className="space-y-1 text-xs">
      <p className="font-medium break-words">{commit.summary}</p>
      <p className="text-muted-foreground">
        {commit.author} · {new Date(commit.authorTime * 1000).toLocaleString()}
      </p>
      <p className="font-mono text-muted-foreground">{commit.sha.slice(0, 10)}</p>
    </div>
  )
}

/**
 * Who last changed each line, beside the editor like JetBrains' annotations: hover names the
 * commit, a click opens its change to this file.
 */
export function GitBlameColumn({
  mountedEditor,
  fileId,
  filePath
}: {
  mountedEditor: editor.IStandaloneCodeEditor | null
  fileId: string
  filePath: string
}): React.JSX.Element | null {
  const blame = useEditorGitBlame((s) => s.byFile[fileId])
  const lineShas = useMonacoGitBlameLines(mountedEditor, fileId, blame)
  const [hoveredSha, setHoveredSha] = useState<string | null>(null)
  const [menuCommit, setMenuCommit] = useState<GitBlameCommit | null>(null)
  useEditorViewport(mountedEditor)
  if (!blame || !mountedEditor) {
    return null
  }
  if (blame.status === 'loading') {
    return (
      <div className="flex w-56 shrink-0 items-start gap-1.5 border-r border-border px-2 py-1 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" />
        {translate('auto.components.editor.gitBlame.loading', 'Loading blame…')}
      </div>
    )
  }

  const lineHeight = mountedEditor.getOption(monaco.editor.EditorOption.lineHeight)
  const scrollTop = mountedEditor.getScrollTop()
  const rows: { line: number; top: number; sha: string | null; runStart: boolean }[] = []
  for (const range of mountedEditor.getVisibleRanges()) {
    for (let line = range.startLineNumber; line <= range.endLineNumber; line++) {
      const sha = lineShas[line - 1] ?? null
      const previous = rows.at(-1)
      rows.push({
        line,
        top: mountedEditor.getTopForLineNumber(line) - scrollTop,
        sha,
        runStart: previous !== undefined && previous.sha !== sha
      })
    }
  }

  return (
    <ContextMenu onOpenChange={(open) => !open && setMenuCommit(null)}>
      <ContextMenuTrigger asChild>
        <div
          className="relative w-56 shrink-0 overflow-hidden border-r border-border text-xs text-muted-foreground"
          onMouseLeave={() => setHoveredSha(null)}
        >
          {rows.map(({ line, top, sha, runStart }) => {
            const commit = sha ? blame.commits[sha] : undefined
            const style = { top, height: lineHeight }
            const rowClass = cn(
              'absolute inset-x-0 flex items-center gap-2 px-2',
              runStart && 'border-t border-border',
              sha !== null && sha === hoveredSha && 'bg-accent text-foreground'
            )
            if (!commit || !sha || isUncommittedBlameSha(sha)) {
              return (
                <div key={line} className={rowClass} style={style}>
                  {sha
                    ? translate('auto.components.editor.gitBlame.uncommitted', 'Not committed')
                    : ''}
                </div>
              )
            }
            return (
              <HoverCard key={line} openDelay={500} closeDelay={80}>
                <HoverCardTrigger asChild>
                  <button
                    type="button"
                    className={cn(rowClass, 'text-left')}
                    style={style}
                    onMouseEnter={() => setHoveredSha(sha)}
                    onClick={() => openGitBlameCommit(filePath, commit)}
                    onContextMenu={() => setMenuCommit(commit)}
                  >
                    <span className="min-w-0 flex-1 truncate">{commit.author}</span>
                    <span className="shrink-0 tabular-nums">{blameDate(commit.authorTime)}</span>
                  </button>
                </HoverCardTrigger>
                <HoverCardContent side="right" align="start">
                  <BlameCommitCard commit={commit} />
                </HoverCardContent>
              </HoverCard>
            )
          })}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {menuCommit ? (
          <>
            <ContextMenuItem onSelect={() => openGitBlameCommit(filePath, menuCommit)}>
              {translate('auto.components.editor.gitBlame.openCommit', 'Open Commit Changes')}
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => void window.api.ui.writeClipboardText(menuCommit.sha)}>
              {translate('auto.components.editor.gitBlame.copyHash', 'Copy Commit Hash')}
            </ContextMenuItem>
          </>
        ) : null}
        <ContextMenuItem onSelect={() => hideEditorGitBlame(fileId)}>
          {translate('auto.components.editor.gitBlame.hide', 'Hide Git Blame')}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
