import { useEffect, useState } from 'react'
import type {
  BuildWebIssueDetail,
  BuildWebIssueFile
} from '../../../../../../src/shared/build-web-types'
import {
  filesWithRole,
  followFile
} from '../../../../../../src/renderer/src/components/build-web/issue/plan/issue-file-roles'
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

type PlanRead = { id: string; name: string; text: string | null; error: string | null }

/**
 * The task's plan files, the newest shown first, and the text of the one shown. The plan attached
 * again under its name stays on screen until the new one is read.
 */
export function useIssuePlan(detail: BuildWebIssueDetail | null): IssuePlan {
  const { call, hostCapabilities } = useBuildWebScreen()
  const plans = detail ? filesWithRole(detail.files, 'plan') : []
  const issueId = detail?.id ?? null
  const [picked, setPicked] = useState<Pick<BuildWebIssueFile, 'id' | 'name'> | null>(null)
  const shown = followFile(plans, picked)
  const [read, setRead] = useState<PlanRead>()
  const shownId = shown?.id ?? null
  const shownName = shown?.name ?? ''
  const capable = canReadIssueFiles(hostCapabilities)
  useEffect(() => {
    if (!issueId || !shownId) {
      return
    }
    if (!capable) {
      setRead({ id: shownId, name: shownName, text: null, error: ISSUE_FILES_REFUSAL })
      return
    }
    let alive = true
    call('issueFile', { id: issueId, fileId: shownId }).then(
      (content) =>
        alive &&
        setRead({ id: shownId, name: shownName, text: utf8OfBase64(content.base64), error: null }),
      (failure) =>
        alive &&
        // Why keep a text of the same name: a failed re-read must not blank the plan shown.
        setRead((prev) =>
          prev?.name === shownName && prev.text !== null
            ? prev
            : { id: shownId, name: shownName, text: null, error: buildWebErrorMessage(failure) }
        )
    )
    return () => {
      alive = false
    }
  }, [call, capable, issueId, shownId, shownName])
  const current = read && (read.id === shownId || read.name === shownName) ? read : null
  return {
    plans,
    shown,
    choose: (fileId) => setPicked(plans.find((p) => p.id === fileId) ?? null),
    text: current?.text ?? null,
    error: current?.error ?? null
  }
}
