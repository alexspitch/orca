import React from 'react'
import { Copy, ExternalLink, History } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { getRuntimeGitRemoteFileUrl } from '@/runtime/runtime-git-working-tree-client'
import { formatPathLineReference } from './line-copy-path'
import { translate } from '@/i18n/i18n'
import { resolveOpenFileGitContext } from './open-file-git-context'
import { hideEditorGitBlame, showEditorGitBlame } from './git-blame/editor-git-blame-actions'
import { useEditorGitBlame } from './git-blame/editor-git-blame-store'

type MonacoGutterContextMenuProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  point: { x: number; y: number }
  line: number
  fileId: string
  filePath: string
  relativePath: string
  /** The editor's text now: blame reads it, not the file, so lines match before a save. */
  getContents: () => string
}

export function MonacoGutterContextMenu({
  open,
  onOpenChange,
  point,
  line,
  fileId,
  filePath,
  relativePath,
  getContents
}: MonacoGutterContextMenuProps): React.JSX.Element {
  const blameShown = useEditorGitBlame((s) => s.byFile[fileId] !== undefined)
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange} modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          aria-hidden
          tabIndex={-1}
          className="pointer-events-none fixed size-px opacity-0"
          style={{ left: point.x, top: point.y }}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent sideOffset={0} align="start">
        <DropdownMenuItem
          onSelect={() => window.api.ui.writeClipboardText(formatPathLineReference(filePath, line))}
        >
          <Copy className="w-3.5 h-3.5 mr-1.5" />
          {translate(
            'auto.components.editor.MonacoGutterContextMenu.4eaa991bde',
            'Copy Path to Line'
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() =>
            window.api.ui.writeClipboardText(formatPathLineReference(relativePath, line))
          }
        >
          <Copy className="w-3.5 h-3.5 mr-1.5" />
          {translate(
            'auto.components.editor.MonacoGutterContextMenu.2e0b1cdc05',
            'Copy Rel. Path to Line'
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={async () => {
            const context = resolveOpenFileGitContext(filePath)
            if (!context) {
              return
            }
            const url = await getRuntimeGitRemoteFileUrl(context, { relativePath, line })
            if (url) {
              window.api.ui.writeClipboardText(url)
            }
          }}
        >
          <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
          {translate(
            'auto.components.editor.MonacoGutterContextMenu.7b57b1b468',
            'Copy Remote URL'
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() =>
            blameShown
              ? hideEditorGitBlame(fileId)
              : void showEditorGitBlame({ fileId, filePath, relativePath, contents: getContents() })
          }
        >
          <History className="w-3.5 h-3.5 mr-1.5" />
          {blameShown
            ? translate('auto.components.editor.gitBlame.hide', 'Hide Git Blame')
            : translate('auto.components.editor.gitBlame.show', 'Git Blame')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
