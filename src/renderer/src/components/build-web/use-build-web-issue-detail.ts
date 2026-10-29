import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type {
  BuildWebIssueDetail,
  BuildWebIssuePatch,
  BuildWebUser,
  BuildWebVersion
} from '../../../../shared/build-web-types'
import {
  afterLiveReading,
  createLiveReads,
  createLiveReplyGuard,
  sameReading
} from '../../../../shared/build-web-live-reads'
import { callBuildWeb } from './build-web-client'
import { useBuildWebStore } from './build-web-store'
import { useBuildWebTarget } from './use-build-web-data'
import { toastJiraOutcome, useConfirmStatusMove } from './use-build-web-issue-write'
import { labelIssuePage } from './page-history/page-history-store'
import { useLiveRead } from './use-live-read'

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

// Why one per renderer: a task shown in a workspace's tab and on the page is read once.
const issueReads = createLiveReads<BuildWebIssueDetail>()

export type IssueDetailState = {
  detail: BuildWebIssueDetail | null
  error: string | null
  assignees: BuildWebUser[]
  versions: BuildWebVersion[]
  saving: boolean
  save: (patch: BuildWebIssuePatch) => Promise<void>
  reload: () => void
}

/**
 * The open task's card, its pickers, and field writes (status without optimism: it moves Jira).
 * Read again every few seconds while `visible`; a reading never replaces the card while a save is
 * out, and an editor keeps its own draft whatever is read.
 */
export function useBuildWebIssueDetail(id: string | null, visible = true): IssueDetailState {
  const { target, contextKey } = useBuildWebTarget()
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
  const [guard] = useState(createLiveReplyGuard)

  const load = useCallback(async () => {
    // Why: bump even with no id, so a late reply for the task just closed is dropped.
    const mine = ++generation.current
    guard.mark()
    if (!id) {
      return
    }
    try {
      const next = await callBuildWeb(target, 'getIssue', { id })
      if (mine !== generation.current) {
        return
      }
      setDetail((shown) => (shown?.id === next.id && sameReading(shown, next) ? shown : next))
      setFailed(null)
      labelIssuePage(next.id, `${next.key} · ${next.title}`)
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
  }, [guard, id, target])

  useEffect(() => {
    void load()
  }, [load])

  useLiveRead(
    issueReads,
    id ? `${contextKey}|${id}` : null,
    visible,
    () => callBuildWeb(target, 'getIssue', { id: id ?? '' }),
    (next, issuedAt) => {
      const accepted = guard.accepts(issuedAt)
      // Why read it whole: the card failed to open and the console answers again.
      if (accepted && error) {
        void load()
        return
      }
      setDetail((shown) => afterLiveReading(shown, next, accepted))
      if (accepted && loaded?.id === next.id) {
        labelIssuePage(next.id, `${next.key} · ${next.title}`)
      }
    }
  )

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
      const endWrite = guard.startWrite()
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
        // Why: the answer is a list row; the card's own fields (stand, its version, the text, the
        // releases of another product) are read again whole.
        if (CARD_FIELDS.some((field) => field in patch)) {
          void load()
        }
      } catch (failure) {
        onOwnCard(() => current)
        toast.error(failure instanceof Error ? failure.message : String(failure))
      } finally {
        endWrite()
        setSavingId((busy) => (busy === current.id ? null : busy))
      }
    },
    [confirmStatusMove, detail, guard, load, patchRow, saving, target]
  )

  const reload = useCallback(() => void load(), [load])
  return { detail, error, assignees, versions, saving, save, reload }
}
