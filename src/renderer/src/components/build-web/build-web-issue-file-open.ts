import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { detectLanguage } from '@/lib/language-detect'
import { isPairedWebClientWindow } from '@/lib/desktop-window-chrome'
import { activateAndRevealWorktree } from '@/lib/worktree-activation'
import { openHtmlFileInBrowser } from '@/components/terminal-pane/terminal-file-open-routing'
import {
  BUILD_WEB_ISSUE_FILE_OPEN_MAX_BYTES,
  type BuildWebIssueDetail,
  type BuildWebIssueFile
} from '../../../../shared/build-web-types'
import { LOCAL_EXECUTION_HOST_ID } from '../../../../shared/execution-host'
import type { RuntimeClientTarget } from '../../../../shared/runtime-client-target'
import { callBuildWeb } from './build-web-client'
import { recordBuildWebCardVisit } from './build-web-card-history'
import { findBuildWebSessionWorktree } from './build-web-session-worktree'

/** Where a task's file opens: Markdown preview, a browser tab, a read-only tab, or the browser. */
export type IssueFileOpenKind = 'markdown' | 'html' | 'tab' | 'browser'

const TEXT_NAME = /\.(txt|log|json|ya?ml|csv|xml|ts|js|py|sh|sql)$/i

export function issueFileOpenKind(
  file: Pick<BuildWebIssueFile, 'name' | 'mime' | 'size'>
): IssueFileOpenKind {
  if (file.size > BUILD_WEB_ISSUE_FILE_OPEN_MAX_BYTES) {
    return 'browser'
  }
  if (/\.(md|markdown)$/i.test(file.name)) {
    return 'markdown'
  }
  if (/\.html?$/i.test(file.name)) {
    return 'html'
  }
  const { mime } = file
  return mime.startsWith('image/') ||
    mime === 'application/pdf' ||
    mime.startsWith('text/') ||
    TEXT_NAME.test(file.name)
    ? 'tab'
    : 'browser'
}

/** The task's own files; a comment's sit under that comment. */
export const taskFilesOf = (detail: BuildWebIssueDetail): BuildWebIssueFile[] =>
  detail.files.filter((file) => file.comment_id === null)

/** The console's own address of a file: the browser signs in to it as build-web's page does. */
export function issueFileConsoleUrl(baseUrl: string, issueId: string, fileId: string): string {
  return `${baseUrl}/api/tms/issues/${encodeURIComponent(issueId)}/files/${encodeURIComponent(fileId)}`
}

/** The task's own worktree when its session is open here, else the one in front. */
function issueWorktreeId(detail: BuildWebIssueDetail): string | null {
  const session = detail.agent_session ? findBuildWebSessionWorktree(detail.agent_session) : null
  return session?.worktreeId ?? useAppStore.getState().activeWorktreeId ?? null
}

function revealWorktree(worktreeId: string): void {
  const hostId = useAppStore.getState().getKnownWorktreeById(worktreeId)?.hostId
  activateAndRevealWorktree(worktreeId, {
    providesInitialSurface: true,
    ...(hostId ? { executionHostId: hostId } : {})
  })
}

/**
 * Open a task's file in a tab of the task's worktree. The file is read through the host that holds
 * the build-web token and written to this computer, so its tab reads it here even when the
 * worktree is on a server (`runtimeEnvironmentId: null`).
 */
export async function openBuildWebIssueFile(args: {
  target: RuntimeClientTarget
  baseUrl: string | null
  detail: BuildWebIssueDetail
  file: BuildWebIssueFile
}): Promise<void> {
  const { target, baseUrl, detail, file } = args
  const kind = issueFileOpenKind(file)
  // Why the web client too: it has no disk of its own to put the file on.
  if (kind === 'browser' || isPairedWebClientWindow()) {
    if (baseUrl) {
      await window.api.shell.openUrl(issueFileConsoleUrl(baseUrl, detail.id, file.id))
    }
    return
  }
  let filePath: string
  try {
    const content = await callBuildWeb(target, 'issueFile', { id: detail.id, fileId: file.id })
    filePath = await window.api.buildWeb.stageIssueFile({
      issueKey: detail.key,
      fileId: file.id,
      name: file.name,
      base64: content.base64
    })
  } catch (error) {
    toast.error(
      translate('buildWeb.files.openFailed', 'Could not open {{name}}: {{error}}', {
        name: file.name,
        error: error instanceof Error ? error.message : String(error)
      })
    )
    return
  }
  const worktreeId = issueWorktreeId(detail)
  if (!worktreeId) {
    await window.api.shell.openFilePath(filePath, LOCAL_EXECUTION_HOST_ID)
    return
  }
  recordBuildWebCardVisit()
  if (kind === 'html') {
    openHtmlFileInBrowser(filePath, worktreeId, true)
    return
  }
  revealWorktree(worktreeId)
  const tab = {
    filePath,
    // Why the absolute path: the file is outside the worktree, as a terminal link to it would be.
    relativePath: filePath,
    worktreeId,
    language: detectLanguage(filePath),
    runtimeEnvironmentId: null
  }
  const store = useAppStore.getState()
  if (kind === 'markdown') {
    store.openMarkdownPreview(tab)
  } else {
    store.openFile({ ...tab, mode: 'edit', readOnly: true })
  }
}
