import { useEffect, useState } from 'react'
import type {
  BuildWebIssueDetail,
  BuildWebIssueFile
} from '../../../../../../shared/build-web-types'
import type { RuntimeClientTarget } from '../../../../../../shared/runtime-client-target'
import { callBuildWeb } from '../../build-web-client'
import { filesWithRole } from './issue-file-roles'

export type IssuePlan = {
  plans: BuildWebIssueFile[]
  shown: BuildWebIssueFile | null
  choose: (fileId: string) => void
  /** The text of `shown`; null while it is read or when it could not be. */
  text: string | null
  error: string | null
}

const utf8Of = (base64: string) =>
  new TextDecoder().decode(Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)))

/** The task's plan, read when the card opens: its tab name shows how far the plan has got. */
export function useIssuePlan(
  target: RuntimeClientTarget,
  detail: BuildWebIssueDetail | null
): IssuePlan {
  const plans = detail ? filesWithRole(detail.files, 'plan') : []
  const issueId = detail?.id ?? null
  const [chosenId, setChosenId] = useState<string | null>(null)
  const shown = plans.find((p) => p.id === chosenId) ?? plans[0] ?? null
  const [read, setRead] = useState<{ id: string; text: string | null; error: string | null }>()
  const shownId = shown?.id ?? null
  useEffect(() => {
    if (!issueId || !shownId) {
      return
    }
    let alive = true
    callBuildWeb(target, 'issueFile', { id: issueId, fileId: shownId }).then(
      (content) => alive && setRead({ id: shownId, text: utf8Of(content.base64), error: null }),
      (failure) =>
        alive &&
        setRead({
          id: shownId,
          text: null,
          error: failure instanceof Error ? failure.message : String(failure)
        })
    )
    return () => {
      alive = false
    }
  }, [target, issueId, shownId])
  const current = read && read.id === shownId ? read : null
  return {
    plans,
    shown,
    choose: setChosenId,
    text: current?.text ?? null,
    error: current?.error ?? null
  }
}
