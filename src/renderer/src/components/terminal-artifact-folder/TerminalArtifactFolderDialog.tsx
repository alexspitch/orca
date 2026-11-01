import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { toast } from 'sonner'
import { Download, FileText, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { translate } from '@/i18n/i18n'
import { extractIpcErrorMessage } from '@/lib/ipc-error'
import { formatBytes } from '@/components/status-bar/workspace-space-format'
import { openLinkedFileInEditor } from '@/components/terminal-pane/terminal-file-link-editor-open'
import { activateAndRevealWorkspace } from '@/lib/worktree-activation'
import { toRuntimeExecutionHostId } from '../../../../shared/execution-host'
import type { RuntimeTerminalArtifactDirectoryListing } from '../../../../shared/runtime-file-contracts'
import {
  downloadTerminalArtifactFile,
  downloadTerminalArtifactFolderZip,
  FOLDER_ZIP_MAX_BYTES,
  grantTerminalArtifactFolderFile,
  listTerminalArtifactFolder,
  type TerminalArtifactFolder
} from './terminal-artifact-folder-client'

// A server folder a terminal printed (an agent's scratchpad): its files to open or download.

const useOpenFolder = create<{ folder: TerminalArtifactFolder | null }>(() => ({ folder: null }))

export function offerTerminalArtifactFolder(folder: TerminalArtifactFolder): void {
  useOpenFolder.setState({ folder })
}

const close = (): void => useOpenFolder.setState({ folder: null })

const failed = (error: unknown, fallback: string): void => {
  toast.error(extractIpcErrorMessage(error, fallback))
}

async function openFile(folder: TerminalArtifactFolder, relativePath: string): Promise<void> {
  const file = await grantTerminalArtifactFolderFile(folder, relativePath)
  activateAndRevealWorkspace(folder.worktreeId, {
    providesInitialSurface: true,
    executionHostId: toRuntimeExecutionHostId(folder.environmentId)
  })
  openLinkedFileInEditor(
    {
      filePath: file.absolutePath,
      relativePath: file.absolutePath,
      worktreeId: folder.worktreeId,
      runtimeEnvironmentId: folder.environmentId,
      // Why: the grant is the only authority to read a host file outside its workspaces.
      readOnly: true,
      terminalArtifactGrantId: file.grantId
    },
    null,
    { line: null, column: null },
    () => true
  )
}

export function TerminalArtifactFolderDialog(): React.JSX.Element | null {
  const folder = useOpenFolder((s) => s.folder)
  const [listing, setListing] = useState<RuntimeTerminalArtifactDirectoryListing | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    setListing(null)
    setError(null)
    if (!folder) {
      return
    }
    let alive = true
    listTerminalArtifactFolder(folder).then(
      (value) => alive && setListing(value),
      (failure: unknown) =>
        alive &&
        setError(
          extractIpcErrorMessage(
            failure,
            translate('terminalArtifactFolder.listFailed', 'Could not list the folder.')
          )
        )
    )
    return () => {
      alive = false
    }
  }, [folder])

  if (!folder) {
    return null
  }
  const run = (key: string, task: () => Promise<unknown>, fallback: string): void => {
    setBusy(key)
    task()
      .catch((failure: unknown) => failed(failure, fallback))
      .finally(() => setBusy(null))
  }
  const total = listing?.entries.reduce((sum, entry) => sum + entry.size, 0) ?? 0
  const zippable = !!listing?.entries.length && total <= FOLDER_ZIP_MAX_BYTES

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {translate('terminalArtifactFolder.title', 'Folder on the server')}
          </DialogTitle>
          <DialogDescription className="font-mono text-xs break-all">
            {folder.absolutePath}
          </DialogDescription>
        </DialogHeader>
        <div className="scrollbar-sleek max-h-[55vh] min-h-24 overflow-y-auto rounded-md border border-border">
          {error ? (
            <p role="alert" className="p-3 text-sm text-destructive">
              {error}
            </p>
          ) : !listing ? (
            <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {translate('terminalArtifactFolder.loading', 'Reading the folder…')}
            </div>
          ) : listing.entries.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">
              {translate('terminalArtifactFolder.empty', 'The folder has no files.')}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {listing.entries.map((entry) => (
                <li key={entry.relativePath} className="flex items-center gap-2 px-3 py-1.5">
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  <span
                    className="min-w-0 flex-1 truncate font-mono text-xs"
                    title={entry.relativePath}
                  >
                    {entry.relativePath}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {formatBytes(entry.size)}
                  </span>
                  <Button
                    variant="ghost"
                    size="xs"
                    disabled={busy !== null}
                    onClick={() =>
                      run(
                        `open:${entry.relativePath}`,
                        async () => {
                          await openFile(folder, entry.relativePath)
                          close()
                        },
                        translate('terminalArtifactFolder.openFailed', 'Could not open the file.')
                      )
                    }
                  >
                    {translate('terminalArtifactFolder.open', 'Open')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    disabled={busy !== null}
                    aria-label={translate('terminalArtifactFolder.download', 'Download')}
                    title={translate('terminalArtifactFolder.download', 'Download')}
                    onClick={() =>
                      run(
                        `download:${entry.relativePath}`,
                        () => downloadTerminalArtifactFile(folder, entry.relativePath),
                        translate(
                          'terminalArtifactFolder.downloadFailed',
                          'Could not download the file.'
                        )
                      )
                    }
                  >
                    {busy === `download:${entry.relativePath}` ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Download />
                    )}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {listing?.truncated ? (
          <p className="text-xs text-muted-foreground">
            {translate(
              'terminalArtifactFolder.truncated',
              'Only the first {{count}} files are listed.',
              { count: listing.entries.length }
            )}
          </p>
        ) : null}
        <DialogFooter>
          <Button
            variant="outline"
            disabled={!zippable || busy !== null}
            title={
              listing && !zippable && listing.entries.length
                ? translate(
                    'terminalArtifactFolder.tooBig',
                    'The folder is over {{size}}; download its files one by one.',
                    { size: formatBytes(FOLDER_ZIP_MAX_BYTES) }
                  )
                : undefined
            }
            onClick={() =>
              listing &&
              run(
                'zip',
                () =>
                  downloadTerminalArtifactFolderZip(
                    folder,
                    listing.entries.map((entry) => entry.relativePath)
                  ),
                translate('terminalArtifactFolder.zipFailed', 'Could not download the folder.')
              )
            }
          >
            {busy === 'zip' ? <Loader2 className="animate-spin" /> : <Download />}
            {translate('terminalArtifactFolder.downloadAll', 'Download all (.zip)')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
