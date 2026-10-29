import { useEffect, useState } from 'react'
import type {
  BuildWebIssueDetail,
  BuildWebIssueFile
} from '../../../../../../shared/build-web-types'
import type { RuntimeClientTarget } from '../../../../../../shared/runtime-client-target'
import { callBuildWeb } from '../../build-web-client'
import { filesWithRole, followFile } from './issue-file-roles'

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

type PlanRead = { id: string; name: string; text: string | null; error: string | null }

/**
 * The task's plan, read when the card opens: its tab name shows how far the plan has got. A file's
 * bytes never change under its id, so the text is read again only for another file; the plan
 * attached again under its name stays on screen until the new one is read.
 */
export function useIssuePlan(
  target: RuntimeClientTarget,
  detail: BuildWebIssueDetail | null
): IssuePlan {
  const plans = detail ? filesWithRole(detail.files, 'plan') : []
  const issueId = detail?.id ?? null
  const [picked, setPicked] = useState<Pick<BuildWebIssueFile, 'id' | 'name'> | null>(null)
  const shown = followFile(plans, picked)
  const [read, setRead] = useState<PlanRead>()
  const shownId = shown?.id ?? null
  const shownName = shown?.name ?? ''
  useEffect(() => {
    if (!issueId || !shownId) {
      return
    }
    let alive = true
    callBuildWeb(target, 'issueFile', { id: issueId, fileId: shownId }).then(
      (content) =>
        alive &&
        setRead({ id: shownId, name: shownName, text: utf8Of(content.base64), error: null }),
      (failure) =>
        alive &&
        // Why keep a text of the same name: a failed re-read must not blank the plan shown.
        setRead((prev) =>
          prev?.name === shownName && prev.text !== null
            ? prev
            : {
                id: shownId,
                name: shownName,
                text: null,
                error: failure instanceof Error ? failure.message : String(failure)
              }
        )
    )
    return () => {
      alive = false
    }
  }, [target, issueId, shownId, shownName])
  const current = read && (read.id === shownId || read.name === shownName) ? read : null
  return {
    plans,
    shown,
    choose: (fileId) => setPicked(plans.find((p) => p.id === fileId) ?? null),
    text: current?.text ?? null,
    error: current?.error ?? null
  }
}
