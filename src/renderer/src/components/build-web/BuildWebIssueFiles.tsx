import { useState } from 'react'
import { ExternalLink, File, FileCode, FileImage, FileText, FileVideo } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { formatBytes } from '@/components/status-bar/workspace-space-format'
import type { BuildWebIssueDetail, BuildWebIssueFile } from '../../../../shared/build-web-types'
import type { RuntimeClientTarget } from '../../../../shared/runtime-client-target'
import { useBuildWebStore } from './build-web-store'
import { issueFileOpenKind, openBuildWebIssueFile } from './build-web-issue-file-open'

function FileIcon({ file }: { file: BuildWebIssueFile }): React.JSX.Element {
  if (file.mime.startsWith('image/')) {
    return <FileImage />
  }
  if (file.mime.startsWith('video/')) {
    return <FileVideo />
  }
  if (/\.html?$/i.test(file.name)) {
    return <FileCode />
  }
  return /\.(md|markdown|txt|log|pdf|docx)$/i.test(file.name) ? <FileText /> : <File />
}

/**
 * Files of the task or of one comment. Markdown, HTML, pictures, PDF, Word documents and text open
 * in a tab of the task's worktree; anything else, or anything too large, opens in the browser.
 */
export function BuildWebIssueFiles({
  target,
  detail,
  files
}: {
  target: RuntimeClientTarget
  detail: BuildWebIssueDetail
  files: readonly BuildWebIssueFile[]
}): React.JSX.Element | null {
  const baseUrl = useBuildWebStore((s) => s.status?.baseUrl ?? null)
  const [opening, setOpening] = useState<string | null>(null)
  if (files.length === 0) {
    return null
  }
  return (
    <ul
      className="flex flex-wrap gap-1.5"
      aria-label={translate('buildWeb.files.label', 'Attachments')}
    >
      {files.map((file) => (
        <li key={file.id} className="min-w-0">
          <Button
            variant="outline"
            size="xs"
            disabled={opening === file.id}
            onClick={() => {
              setOpening(file.id)
              void openBuildWebIssueFile({ target, baseUrl, detail, file }).finally(() =>
                setOpening(null)
              )
            }}
          >
            <FileIcon file={file} />
            <span className="max-w-56 truncate">{file.name}</span>
            <span className="text-muted-foreground tabular-nums">{formatBytes(file.size)}</span>
            {issueFileOpenKind(file) === 'browser' ? <ExternalLink /> : null}
          </Button>
        </li>
      ))}
    </ul>
  )
}
