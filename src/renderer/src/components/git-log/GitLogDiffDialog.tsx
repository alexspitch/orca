import React, { Suspense, lazy, useEffect, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Columns2,
  ExternalLink,
  Loader2,
  Rows2,
  X
} from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { translate } from '@/i18n/i18n'
import { useShortcutKeyDetails } from '@/hooks/useShortcutLabel'
import { detectLanguage } from '@/lib/language-detect'
import { joinPath } from '@/lib/path'
import { errorMessage } from '../../../../shared/error-message'
import type { GitBranchChangeEntry, GitDiffResult } from '../../../../shared/git-diff-compare-types'
import { DiffNavigationProvider, useDiffNavigation } from '../editor/diff-navigation-context'
import { STATUS_COLORS } from '../right-sidebar/status-display'
import { GitLogIconButton } from './GitLogIconButton'
import { GIT_LOG_DIFF_MODEL_PREFIX, disposeGitLogDiffModels } from './git-log-diff-models'

const DiffViewer = lazy(() => import('../editor/DiffViewer'))
const ImageDiffViewer = lazy(() => import('../editor/ImageDiffViewer'))

/** What is compared (a commit with its parent, two revisions, a revision with the working tree). */
export type GitLogDiffTarget = {
  /** Names the comparison; keys the loaded diff together with the file. */
  key: string
  /** The line under the path: the commit, or what is compared with what. */
  subtitle: string
  files: GitBranchChangeEntry[]
  index: number
  load: (entry: GitBranchChangeEntry) => Promise<GitDiffResult>
  /** Offered for a commit's own diff, which the editor can open as a tab. */
  openInEditor?: (entry: GitBranchChangeEntry) => void
}

type DiffState =
  | { status: 'loading' }
  | { status: 'ready'; result: GitDiffResult }
  | { status: 'error'; message: string }

function GitLogDiffToolbar({
  index,
  count,
  onGoToFile,
  sideBySide,
  onToggleSideBySide,
  onOpenInEditor,
  onClose
}: {
  index: number
  count: number
  onGoToFile: (index: number) => void
  sideBySide: boolean
  onToggleSideBySide: () => void
  onOpenInEditor: (() => void) | null
  onClose: () => void
}): React.JSX.Element {
  const { changeCount, goToPreviousDiff, goToNextDiff } = useDiffNavigation()
  const previousShortcut = useShortcutKeyDetails('editor.previousChange')
  const nextShortcut = useShortcutKeyDetails('editor.nextChange')
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <span className="mr-1 text-xs text-muted-foreground tabular-nums">
        {changeCount === 1
          ? translate('gitLog.diff.oneChange', '1 change')
          : translate('gitLog.diff.changes', '{{value0}} changes', { value0: changeCount })}
      </span>
      <GitLogIconButton
        side="bottom"
        label={translate('gitLog.diff.previousChange', 'Previous Change')}
        icon={ArrowUp}
        onClick={goToPreviousDiff}
        disabled={changeCount === 0}
        shortcut={previousShortcut}
      />
      <GitLogIconButton
        side="bottom"
        label={translate('gitLog.diff.nextChange', 'Next Change')}
        icon={ArrowDown}
        onClick={goToNextDiff}
        disabled={changeCount === 0}
        shortcut={nextShortcut}
      />
      <div className="mx-1.5 h-4 w-px bg-border" />
      <GitLogIconButton
        side="bottom"
        label={translate('gitLog.diff.previousFile', 'Previous File')}
        icon={ArrowLeft}
        onClick={() => onGoToFile(index - 1)}
        disabled={index <= 0}
      />
      <span className="px-1 text-xs text-muted-foreground tabular-nums">
        {translate('gitLog.diff.fileOf', '{{value0}} of {{value1}}', {
          value0: index + 1,
          value1: count
        })}
      </span>
      <GitLogIconButton
        side="bottom"
        label={translate('gitLog.diff.nextFile', 'Next File')}
        icon={ArrowRight}
        onClick={() => onGoToFile(index + 1)}
        disabled={index >= count - 1}
      />
      <div className="mx-1.5 h-4 w-px bg-border" />
      <GitLogIconButton
        side="bottom"
        label={
          sideBySide
            ? translate('gitLog.diff.unified', 'Unified Viewer')
            : translate('gitLog.diff.sideBySide', 'Side-by-Side Viewer')
        }
        icon={sideBySide ? Rows2 : Columns2}
        onClick={onToggleSideBySide}
      />
      {onOpenInEditor ? (
        <GitLogIconButton
          side="bottom"
          label={translate('gitLog.diff.openInEditor', 'Open in Editor')}
          icon={ExternalLink}
          onClick={onOpenInEditor}
        />
      ) : null}
      <GitLogIconButton
        side="bottom"
        label={translate('gitLog.diff.close', 'Close')}
        icon={X}
        onClick={onClose}
      />
    </div>
  )
}

function DiffBody({
  diff,
  entry,
  modelKey,
  worktreePath,
  sideBySide
}: {
  diff: DiffState
  entry: GitBranchChangeEntry
  modelKey: string
  worktreePath: string
  sideBySide: boolean
}): React.JSX.Element {
  const loading = (
    <div className="flex flex-1 items-center justify-center gap-2 text-xs text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
      {translate('gitLog.diff.loading', 'Loading the diff…')}
    </div>
  )
  if (diff.status === 'loading') {
    return loading
  }
  if (diff.status === 'error') {
    return <div className="p-4 text-xs text-destructive">{diff.message}</div>
  }
  const filePath = joinPath(worktreePath, entry.path)
  const { result } = diff
  if (result.kind === 'binary') {
    return result.isImage ? (
      <Suspense fallback={loading}>
        <ImageDiffViewer
          originalContent={result.originalContent}
          modifiedContent={result.modifiedContent}
          filePath={filePath}
          mimeType={result.mimeType}
          sideBySide={sideBySide}
        />
      </Suspense>
    ) : (
      <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
        {translate('gitLog.diff.binary', 'Binary file: no text to compare')}
      </div>
    )
  }
  return (
    <Suspense fallback={loading}>
      <DiffViewer
        modelKey={modelKey}
        originalContent={result.originalContent}
        modifiedContent={result.modifiedContent}
        language={detectLanguage(entry.path)}
        filePath={filePath}
        relativePath={entry.path}
        sideBySide={sideBySide}
        largeDiffRenderLimit={result.largeDiffRenderLimit}
        largeDiffSaveContentAvailable={false}
      />
    </Suspense>
  )
}

/**
 * A file's diff in a modal, as WebStorm opens one from the log: previous/next change
 * (F7 / Shift+F7 in the editor) and previous/next file of the same comparison.
 */
export function GitLogDiffDialog({
  target,
  worktreePath,
  onGoToFile,
  onClose
}: {
  target: GitLogDiffTarget | null
  worktreePath: string
  onGoToFile: (index: number) => void
  onClose: () => void
}): React.JSX.Element {
  const [sideBySide, setSideBySide] = useState(true)
  const [loaded, setLoaded] = useState<{ key: string; diff: DiffState } | null>(null)
  const entry = target ? (target.files[target.index] ?? null) : null
  // Why keyed: until the next file's diff lands, show loading rather than the previous file's.
  const diffKey = target && entry ? `${target.key}:${entry.path}` : ''
  const diff: DiffState = loaded?.key === diffKey ? loaded.diff : { status: 'loading' }
  const latest = useRef({ target, entry })
  latest.current = { target, entry }

  // The previous comparison's models are unattached by the time another one opens.
  const targetKey = target?.key ?? null
  useEffect(() => {
    disposeGitLogDiffModels()
  }, [targetKey])
  // Why deferred: the viewer lets go of its models in its own cleanup.
  useEffect(() => () => void window.setTimeout(disposeGitLogDiffModels, 0), [])

  useEffect(() => {
    const { target: current, entry: file } = latest.current
    if (!diffKey || !current || !file) {
      return
    }
    let stale = false
    current.load(file).then(
      (result) => !stale && setLoaded({ key: diffKey, diff: { status: 'ready', result } }),
      (error: unknown) =>
        !stale &&
        setLoaded({ key: diffKey, diff: { status: 'error', message: errorMessage(error) } })
    )
    return () => {
      stale = true
    }
  }, [diffKey])

  return (
    <Dialog open={target !== null && entry !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="flex h-[calc(100vh-4rem)] flex-col sm:max-w-[calc(100vw-4rem)]"
      >
        {target && entry ? (
          <DiffNavigationProvider>
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              <div className="flex min-w-0 shrink-0 items-start gap-3">
                <div className="min-w-0 flex-1">
                  <DialogTitle className="min-w-0">
                    <span
                      className="block truncate font-mono text-sm font-normal"
                      style={{ color: STATUS_COLORS[entry.status] }}
                    >
                      {entry.path}
                    </span>
                  </DialogTitle>
                  <div className="mt-1 truncate text-xs text-muted-foreground">
                    {entry.oldPath
                      ? translate('gitLog.diff.renamedFrom', 'Renamed from {{value0}}', {
                          value0: entry.oldPath
                        })
                      : null}
                    {entry.oldPath ? ' · ' : null}
                    {target.subtitle}
                  </div>
                </div>
                <GitLogDiffToolbar
                  index={target.index}
                  count={target.files.length}
                  onGoToFile={onGoToFile}
                  sideBySide={sideBySide}
                  onToggleSideBySide={() => setSideBySide(!sideBySide)}
                  onOpenInEditor={target.openInEditor ? () => target.openInEditor?.(entry) : null}
                  onClose={onClose}
                />
              </div>
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border">
                <DiffBody
                  diff={diff}
                  entry={entry}
                  modelKey={`${GIT_LOG_DIFF_MODEL_PREFIX}${diffKey}`}
                  worktreePath={worktreePath}
                  sideBySide={sideBySide}
                />
              </div>
            </div>
          </DiffNavigationProvider>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
