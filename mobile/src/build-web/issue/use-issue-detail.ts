import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  BuildWebIssueDetail,
  BuildWebIssuePatch,
  BuildWebUser,
  BuildWebVersion
} from '../../../../src/shared/build-web-types'
import { buildWebErrorMessage, callBuildWeb } from '../build-web-operations'
import { useBuildWebScreen } from '../build-web-screen-context'
import { confirmStatusMove, notifyJiraOutcome, patchRefusal } from './issue-status-move'
import type { IssueConfirm } from './use-issue-confirm'

const CARD_FIELDS = [
  'product',
  'stand_id',
  'stand_mode',
  'version',
  // Why: the release decides the task's branches, which the Build tab builds from.
  'version_id',
  'description',
  'steps'
] as const

// Why: a host announcing build-web.v1 may predate a list the card reads; absent reads as empty.
function withDetailLists(detail: BuildWebIssueDetail): BuildWebIssueDetail {
  return {
    ...detail,
    steps: Array.isArray(detail.steps) ? detail.steps : [],
    branches: Array.isArray(detail.branches) ? detail.branches : [],
    comments: Array.isArray(detail.comments) ? detail.comments : [],
    files: Array.isArray(detail.files) ? detail.files : []
  }
}

export type IssueDetailState = {
  detail: BuildWebIssueDetail | null
  error: string | null
  assignees: BuildWebUser[]
  versions: BuildWebVersion[]
  saving: boolean
  /** Resolves true once the console took the change; an editor keeps its draft otherwise. */
  save: (patch: BuildWebIssuePatch) => Promise<boolean>
  reload: () => void
  /** Shown at once, before the console answers: the star. */
  patchLocal: (patch: Partial<BuildWebIssueDetail>) => void
}

/** The open task's card, its pickers, and field writes (status without optimism: it moves Jira). */
export function useIssueDetail(id: string, confirm: IssueConfirm): IssueDetailState {
  const { client, hostCapabilities, notify, listSync } = useBuildWebScreen()
  const [loaded, setDetail] = useState<BuildWebIssueDetail | null>(null)
  const [failed, setFailed] = useState<{ id: string; message: string } | null>(null)
  const detail = loaded && loaded.id === id ? loaded : null
  const error = failed && failed.id === id ? failed.message : null
  const [assignees, setAssignees] = useState<BuildWebUser[]>([])
  const [releases, setReleases] = useState<{ product: string; list: BuildWebVersion[] } | null>(
    null
  )
  // Why per product: another product's releases must never be offered for this task.
  const versions = detail && releases?.product === detail.product ? releases.list : []
  const [saving, setSaving] = useState(false)
  const generation = useRef(0)

  const load = useCallback(async () => {
    const mine = ++generation.current
    try {
      const next = withDetailLists(await callBuildWeb(client, 'getIssue', { id }))
      if (mine !== generation.current) {
        return
      }
      setDetail(next)
      setFailed(null)
      const [users, list] = await Promise.all([
        callBuildWeb(client, 'listAssignees').catch(() => []),
        next.product === 'unknown'
          ? []
          : callBuildWeb(client, 'listVersions', { product: next.product }).catch(() => [])
      ])
      if (mine === generation.current) {
        setAssignees(users)
        setReleases({ product: next.product, list })
      }
    } catch (failure) {
      if (mine === generation.current) {
        setFailed({ id, message: buildWebErrorMessage(failure) })
      }
    }
  }, [client, id])

  useEffect(() => {
    void load()
  }, [load])

  const save = useCallback(
    async (patch: BuildWebIssuePatch): Promise<boolean> => {
      const current = detail
      if (!current || saving) {
        return false
      }
      const refusal = patchRefusal(hostCapabilities, patch)
      if (refusal) {
        notify(refusal, 'error')
        return false
      }
      const onOwnCard = (update: (shown: BuildWebIssueDetail) => BuildWebIssueDetail) =>
        setDetail((shown) => (shown && shown.id === current.id ? update(shown) : shown))
      if (!(await confirmStatusMove(confirm, current, patch))) {
        return false
      }
      const optimistic = patch.status === undefined
      if (optimistic) {
        onOwnCard(() => ({ ...current, ...patch }))
      }
      setSaving(true)
      try {
        const result = await callBuildWeb(client, 'updateIssue', { id: current.id, patch })
        if (!result.ok) {
          onOwnCard(() => current)
          notify(result.error, 'error')
          return false
        }
        const issue = result.value.issue
        if (issue) {
          onOwnCard((shown) => ({ ...shown, ...issue }))
          listSync.patch(issue.id, issue)
        }
        notifyJiraOutcome(notify, patch, result.value.jira)
        // Why: the answer is a list row; the card's own fields are read again whole.
        if (CARD_FIELDS.some((field) => field in patch)) {
          void load()
        }
        return true
      } catch (failure) {
        onOwnCard(() => current)
        notify(buildWebErrorMessage(failure), 'error')
        return false
      } finally {
        setSaving(false)
      }
    },
    [client, confirm, detail, hostCapabilities, listSync, load, notify, saving]
  )

  const patchLocal = useCallback(
    (patch: Partial<BuildWebIssueDetail>) =>
      setDetail((shown) => (shown && shown.id === id ? { ...shown, ...patch } : shown)),
    [id]
  )
  const reload = useCallback(() => void load(), [load])
  return { detail, error, assignees, versions, saving, save, reload, patchLocal }
}
