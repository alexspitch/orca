import { useEffect, useState } from 'react'
import type { BuildWebIssueDetail } from '../../../../src/shared/build-web-types'
import { BUILD_WEB_ISSUE_FILES_RUNTIME_CAPABILITY } from '../../../../src/shared/build-web-capability'
import {
  filesWithRole,
  planProgress
} from '../../../../src/renderer/src/components/build-web/issue/plan/issue-file-roles'
import { callBuildWeb } from '../build-web-operations'
import { useBuildWebScreen } from '../build-web-screen-context'
import { utf8OfBase64 } from './issue-attachment-kind'

/** The Plan tab's name, as build-web's: how far the newest plan has got once read, else how many plans. */
export function usePlanTabLabel(detail: BuildWebIssueDetail | null): string {
  const { client, hostCapabilities } = useBuildWebScreen()
  const plans = detail ? filesWithRole(detail.files, 'plan') : []
  const newestId = plans[0]?.id ?? null
  const newestName = plans[0]?.name ?? ''
  const issueId = detail?.id ?? null
  const readable = hostCapabilities.includes(BUILD_WEB_ISSUE_FILES_RUNTIME_CAPABILITY)
  const [steps, setSteps] = useState<{
    id: string
    name: string
    done: number
    total: number
  } | null>(null)
  useEffect(() => {
    if (!issueId || !newestId || !readable) {
      return
    }
    let alive = true
    callBuildWeb(client, 'issueFile', { id: issueId, fileId: newestId }).then(
      (content) =>
        alive &&
        setSteps({
          id: newestId,
          name: newestName,
          ...planProgress(utf8OfBase64(content.base64))
        }),
      () => undefined
    )
    return () => {
      alive = false
    }
  }, [client, issueId, newestId, newestName, readable])
  // Why by name too: the plan attached again keeps its count until the new one is read.
  const current = steps && (steps.id === newestId || steps.name === newestName) ? steps : null
  if (current?.total) {
    return `Plan ${current.done} / ${current.total}`
  }
  return plans.length ? `Plan ${plans.length}` : 'Plan'
}
