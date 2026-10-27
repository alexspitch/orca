import { useEffect, useState } from 'react'
import {
  BUILD_WEB_ISSUE_FILE_OPEN_MAX_BYTES,
  type BuildWebIssueFile,
  type BuildWebMockupView
} from '../../../../../../src/shared/build-web-types'
import { buildWebErrorMessage } from '../../../build-web-operations'
import { useBuildWebScreen } from '../../../build-web-screen-context'
import {
  canReadIssueFiles,
  canViewIssueMockups,
  ISSUE_MOCKUPS_REFUSAL,
  utf8OfBase64
} from './issue-file-read'

/** What the phone draws in place: a page (scripts off) or a picture. An archive opens in the browser. */
export type MockupPreview = { kind: 'html'; html: string } | { kind: 'image'; uri: string }

function previewKindOf(file: BuildWebIssueFile): MockupPreview['kind'] | null {
  if (file.size > BUILD_WEB_ISSUE_FILE_OPEN_MAX_BYTES) {
    return null
  }
  if (file.mime.startsWith('image/')) {
    return 'image'
  }
  return file.mime === 'text/html' || /\.html?$/i.test(file.name) ? 'html' : null
}

export type IssueMockup = {
  view: BuildWebMockupView | null
  viewError: string | null
  preview: MockupPreview | null
  previewLoading: boolean
  previewError: string | null
}

/** A mockup's addresses (a fresh one each time it is opened: one works for a few hours only) and its preview. */
export function useIssueMockup(issueId: string, file: BuildWebIssueFile | null): IssueMockup {
  const { call, hostCapabilities } = useBuildWebScreen()
  const [view, setView] = useState<BuildWebMockupView | null>(null)
  const [viewError, setViewError] = useState<string | null>(null)
  const [preview, setPreview] = useState<MockupPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const viewCapable = canViewIssueMockups(hostCapabilities)
  const filesCapable = canReadIssueFiles(hostCapabilities)
  const fileId = file?.id ?? null
  const kind = file ? previewKindOf(file) : null

  useEffect(() => {
    if (!fileId) {
      return
    }
    setView(null)
    setViewError(null)
    if (!viewCapable) {
      setViewError(ISSUE_MOCKUPS_REFUSAL)
      return
    }
    let alive = true
    call('issueMockupView', { id: issueId, fileId }).then(
      (next) => alive && setView(next),
      (failure) => alive && setViewError(buildWebErrorMessage(failure))
    )
    return () => {
      alive = false
    }
  }, [call, issueId, fileId, viewCapable])

  useEffect(() => {
    setPreview(null)
    setPreviewError(null)
    if (!fileId || !kind || !filesCapable) {
      setPreviewLoading(false)
      return
    }
    let alive = true
    setPreviewLoading(true)
    call('issueFile', { id: issueId, fileId })
      .then(
        (content) =>
          alive &&
          setPreview(
            kind === 'html'
              ? { kind, html: utf8OfBase64(content.base64) }
              : { kind, uri: `data:${content.mime};base64,${content.base64}` }
          ),
        (failure) => alive && setPreviewError(buildWebErrorMessage(failure))
      )
      .finally(() => alive && setPreviewLoading(false))
    return () => {
      alive = false
    }
  }, [call, issueId, fileId, kind, filesCapable])

  return { view, viewError, preview, previewLoading, previewError }
}
