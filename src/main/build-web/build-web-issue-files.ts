import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  BUILD_WEB_ISSUE_FILE_OPEN_MAX_BYTES,
  type BuildWebIssueFileContent
} from '../../shared/build-web-types'
import { getAppEnvironment } from '../../shared/app-environment'
import { requireBuildWebCredential } from './build-web-connection'
import { buildWebBinaryRequest } from './build-web-request'

const enc = encodeURIComponent

/** One file of a task, read with the token — the token never goes into a URL Orca opens. */
export async function getBuildWebIssueFile(
  id: string,
  fileId: string
): Promise<BuildWebIssueFileContent> {
  const credential = requireBuildWebCredential()
  const { mime, bytes } = await buildWebBinaryRequest({
    ...credential,
    path: `/api/tms/issues/${enc(id)}/files/${enc(fileId)}`,
    maxBytes: BUILD_WEB_ISSUE_FILE_OPEN_MAX_BYTES,
    anyType: true
  })
  return { mime, base64: Buffer.from(bytes).toString('base64') }
}

/** A file name safe as one path segment on every platform, its extension kept. */
export function stagedFileName(name: string): string {
  const safe = name
    .replace(/[\p{Cc}<>:"/\\|?*]+/gu, '_')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .slice(-120)
  return safe || 'file'
}

/**
 * A task's file written where this computer's tabs can open it, by task and file id so two files
 * of one name never meet: `<userData>/build-web-files/<key>/<file id>/<name>`.
 */
export async function stageBuildWebIssueFile(args: {
  issueKey: string
  fileId: string
  name: string
  base64: string
}): Promise<string> {
  const dir = join(
    getAppEnvironment().getPath('userData'),
    'build-web-files',
    args.issueKey,
    args.fileId
  )
  await mkdir(dir, { recursive: true })
  const filePath = join(dir, stagedFileName(args.name))
  await writeFile(filePath, Buffer.from(args.base64, 'base64'))
  return filePath
}
