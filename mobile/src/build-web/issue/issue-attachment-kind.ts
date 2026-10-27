import {
  BUILD_WEB_ISSUE_FILE_OPEN_MAX_BYTES,
  type BuildWebIssueDetail,
  type BuildWebIssueFile
} from '../../../../src/shared/build-web-types'
import { decodeBase64Bytes } from '../../transport/base64-byte-codec'

// The desktop stages a task's file into a worktree tab; the phone has no worktree, so what it can
// show it shows in a sheet, and the rest opens at the console's address in the browser.

export type IssueAttachmentKind = 'image' | 'markdown' | 'html' | 'text' | 'browser'

const TEXT_NAME = /\.(txt|log|json|ya?ml|csv|xml|ts|js|py|sh|sql)$/i

export function issueAttachmentKind(
  file: Pick<BuildWebIssueFile, 'name' | 'mime' | 'size'>
): IssueAttachmentKind {
  if (file.size > BUILD_WEB_ISSUE_FILE_OPEN_MAX_BYTES) {
    return 'browser'
  }
  if (/\.(md|markdown)$/i.test(file.name)) {
    return 'markdown'
  }
  if (/\.html?$/i.test(file.name)) {
    return 'html'
  }
  if (file.mime.startsWith('image/')) {
    return 'image'
  }
  return file.mime.startsWith('text/') || TEXT_NAME.test(file.name) ? 'text' : 'browser'
}

/** The task's own files; a comment's sit under that comment. */
export const taskFilesOf = (detail: BuildWebIssueDetail): BuildWebIssueFile[] =>
  detail.files.filter((file) => file.comment_id === null)

/** The console's own address of a file: the browser signs in to it as build-web's page does. */
export function issueFileConsoleUrl(baseUrl: string, issueId: string, fileId: string): string {
  return `${baseUrl}/api/tms/issues/${encodeURIComponent(issueId)}/files/${encodeURIComponent(fileId)}`
}

export const utf8OfBase64 = (base64: string): string =>
  new TextDecoder().decode(decodeBase64Bytes(base64))

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB'] as const

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B'
  }
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024
    unit += 1
  }
  const precision = value >= 100 || unit === 0 ? 0 : value >= 10 ? 1 : 2
  return `${value.toFixed(precision)} ${BYTE_UNITS[unit]}`
}
