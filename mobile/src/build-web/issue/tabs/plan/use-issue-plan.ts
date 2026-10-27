import { useEffect, useState } from 'react'
import type {
  BuildWebIssueDetail,
  BuildWebIssueFile
} from '../../../../../../src/shared/build-web-types'
import { filesWithRole } from '../../../../../../src/renderer/src/components/build-web/issue/plan/issue-file-roles'
import { buildWebErrorMessage } from '../../../build-web-operations'
import { useBuildWebScreen } from '../../../build-web-screen-context'
import { canReadIssueFiles, ISSUE_FILES_REFUSAL, utf8OfBase64 } from './issue-file-read'

export type IssuePlan = {
  plans: BuildWebIssueFile[]
  shown: BuildWebIssueFile | null
  choose: (fileId: string) => void
  /** The text of `shown`; null while it is read or when it could not be. */
  text: string | null
  error: string | null
}

/** The task's plan files, the newest shown first, and the text of the one shown. */
export function useIssuePlan(detail: BuildWebIssueDetail | null): IssuePlan {
  const { call, hostCapabilities } = useBuildWebScreen()
  const plans = detail ? filesWithRole(detail.files, 'plan') : []
  const issueId = detail?.id ?? null
  const [chosenId, setChosenId] = useState<string | null>(null)
  const shown = plans.find((p) => p.id === chosenId) ?? plans[0] ?? null
  const [read, setRead] = useState<{ id: string; text: string | null; error: string | null }>()
  const shownId = shown?.id ?? null
  const capable = canReadIssueFiles(hostCapabilities)
  useEffect(() => {
    if (!issueId || !shownId) {
      return
    }
    if (!capable) {
      setRead({ id: shownId, text: null, error: ISSUE_FILES_REFUSAL })
      return
    }
    let alive = true
    call('issueFile', { id: issueId, fileId: shownId }).then(
      (content) =>
        alive && setRead({ id: shownId, text: utf8OfBase64(content.base64), error: null }),
      (failure) =>
        alive && setRead({ id: shownId, text: null, error: buildWebErrorMessage(failure) })
    )
    return () => {
      alive = false
    }
  }, [call, capable, issueId, shownId])
  const current = read && read.id === shownId ? read : null
  return {
    plans,
    shown,
    choose: setChosenId,
    text: current?.text ?? null,
    error: current?.error ?? null
  }
}
