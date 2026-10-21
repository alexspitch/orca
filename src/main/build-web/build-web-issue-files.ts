import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  BUILD_WEB_ISSUE_FILE_OPEN_MAX_BYTES,
  type BuildWebIssueFileContent,
  type BuildWebMockupView
} from '../../shared/build-web-types'
import { getAppEnvironment } from '../../shared/app-environment'
import { requireBuildWebCredential } from './build-web-connection'
import { buildWebBinaryRequest, buildWebRequest } from './build-web-request'
import { consoleUrlOf, recordOf } from './build-web-response-fields'

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

/**
 * The console's answer as an address the card can frame: `base` made absolute, and only under the
 * console's own `/mockups/` — the frame loads whatever this names.
 */
export function mockupViewOf(value: unknown, baseUrl: string): BuildWebMockupView {
  const v = recordOf(value)
  const base = typeof v?.base === 'string' ? consoleUrlOf(v.base, baseUrl) : null
  if (!base || !base.startsWith(`${new URL(baseUrl).origin}/mockups/`)) {
    throw new Error('build-web named no address for this mockup')
  }
  const screens = (Array.isArray(v?.screens) ? v.screens : [])
    .map(recordOf)
    .filter(
      (s): s is { name: string; path: string } =>
        typeof s?.name === 'string' && typeof s.path === 'string' && !/^[a-z]+:|^\/\//i.test(s.path)
    )
    .map((s) => ({ name: s.name, path: s.path }))
  return { base, screens }
}

/** Where a mockup of a task is shown; the address works for a few hours, so it is asked each time. */
export async function getBuildWebIssueMockupView(
  id: string,
  fileId: string
): Promise<BuildWebMockupView> {
  const credential = requireBuildWebCredential()
  const answer = await buildWebRequest({
    ...credential,
    path: `/api/tms/issues/${enc(id)}/files/${enc(fileId)}/view`
  })
  return mockupViewOf(answer, credential.baseUrl)
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
