import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type {
  BuildWebIssueDetail,
  BuildWebIssuePatch,
  BuildWebUser,
  BuildWebVersion
} from '../../../../shared/build-web-types'
import { callBuildWeb } from './build-web-client'
import { useBuildWebStore } from './build-web-store'
import { useBuildWebTarget } from './use-build-web-data'
import { toastJiraOutcome, useConfirmStatusMove } from './use-build-web-issue-write'

export type IssueDetailState = {
  detail: BuildWebIssueDetail | null
  error: string | null
  assignees: BuildWebUser[]
  versions: BuildWebVersion[]
  saving: boolean
  save: (patch: BuildWebIssuePatch) => Promise<void>
  reload: () => void
}

/** The open task's card, its pickers, and field writes (status without optimism: it moves Jira). */
export function useBuildWebIssueDetail(id: string | null): IssueDetailState {
  const { target } = useBuildWebTarget()
  const confirmStatusMove = useConfirmStatusMove()
  const patchRow = useBuildWebStore((s) => s.patchIssue)
  const [loaded, setDetail] = useState<BuildWebIssueDetail | null>(null)
  const [failed, setFailed] = useState<{ id: string; message: string } | null>(null)
  // Why: another task's card must not show or stay editable while this one loads — save acts on it.
  const detail = loaded && loaded.id === id ? loaded : null
  const error = failed && failed.id === id ? failed.message : null
  const [assignees, setAssignees] = useState<BuildWebUser[]>([])
  const [releases, setReleases] = useState<{ product: string; list: BuildWebVersion[] } | null>(
    null
  )
  // Why per product: another product's releases must never be offered for this task.
  const versions = detail && releases?.product === detail.product ? releases.list : []
  const [savingId, setSavingId] = useState<string | null>(null)
  const saving = savingId !== null && savingId === id
  const generation = useRef(0)

  const load = useCallback(async () => {
    // Why: bump even with no id, so a late reply for the task just closed is dropped.
    const mine = ++generation.current
    if (!id) {
      return
    }
    try {
      const next = await callBuildWeb(target, 'getIssue', { id })
      if (mine !== generation.current) {
        return
      }
      setDetail(next)
      setFailed(null)
      const [users, list] = await Promise.all([
        callBuildWeb(target, 'listAssignees').catch(() => []),
        next.product === 'unknown'
          ? []
          : callBuildWeb(target, 'listVersions', { product: next.product }).catch(() => [])
      ])
      if (mine === generation.current) {
        setAssignees(users)
        setReleases({ product: next.product, list })
      }
    } catch (failure) {
      if (mine === generation.current) {
        setFailed({ id, message: failure instanceof Error ? failure.message : String(failure) })
      }
    }
  }, [id, target])

  useEffect(() => {
    void load()
  }, [load])

  const save = useCallback(
    async (patch: BuildWebIssuePatch) => {
      const current = detail
      if (!current || saving) {
        return
      }
      // Why: the reply may land after another task opened; it only ever touches its own card.
      const onOwnCard = (update: (shown: BuildWebIssueDetail) => BuildWebIssueDetail) =>
        setDetail((shown) => (shown && shown.id === current.id ? update(shown) : shown))
      if (!(await confirmStatusMove(current, patch))) {
        return
      }
      const optimistic = patch.status === undefined
      if (optimistic) {
        onOwnCard(() => ({ ...current, ...patch }))
      }
      setSavingId(current.id)
      try {
        const result = await callBuildWeb(target, 'updateIssue', { id: current.id, patch })
        if (!result.ok) {
          onOwnCard(() => current)
          toast.error(result.error)
          return
        }
        const issue = result.value.issue
        if (issue) {
          onOwnCard((shown) => ({ ...shown, ...issue }))
          patchRow(current.id, issue)
        }
        toastJiraOutcome(patch, result.value.jira)
      } catch (failure) {
        onOwnCard(() => current)
        toast.error(failure instanceof Error ? failure.message : String(failure))
      } finally {
        setSavingId((busy) => (busy === current.id ? null : busy))
      }
    },
    [confirmStatusMove, detail, patchRow, saving, target]
  )

  return { detail, error, assignees, versions, saving, save, reload: () => void load() }
}
