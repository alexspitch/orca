import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type {
  BuildWebIssueDetail,
  BuildWebIssuePatch,
  BuildWebUser,
  BuildWebVersion
} from '../../../../shared/build-web-types'
import { useConfirmationDialog } from '@/components/confirmation-dialog-context'
import { translate } from '@/i18n/i18n'
import { callBuildWeb } from './build-web-client'
import { useBuildWebStore } from './build-web-store'
import { useBuildWebTarget } from './use-build-web-data'
import { statusLabel } from './build-web-labels'

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
  const confirm = useConfirmationDialog()
  const patchRow = useBuildWebStore((s) => s.patchIssue)
  const [detail, setDetail] = useState<BuildWebIssueDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [assignees, setAssignees] = useState<BuildWebUser[]>([])
  const [versions, setVersions] = useState<BuildWebVersion[]>([])
  const [saving, setSaving] = useState(false)
  const generation = useRef(0)

  const load = useCallback(async () => {
    if (!id) {
      setDetail(null)
      return
    }
    const mine = ++generation.current
    try {
      const next = await callBuildWeb(target, 'getIssue', { id })
      if (mine !== generation.current) {
        return
      }
      setDetail(next)
      setError(null)
      const [users, releases] = await Promise.all([
        callBuildWeb(target, 'listAssignees').catch(() => []),
        callBuildWeb(target, 'listVersions', { product: next.product }).catch(() => [])
      ])
      if (mine === generation.current) {
        setAssignees(users)
        setVersions(releases)
      }
    } catch (failure) {
      if (mine === generation.current) {
        setError(failure instanceof Error ? failure.message : String(failure))
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
      if (patch.status && current.jira_key) {
        const accepted = await confirm({
          title: translate('buildWeb.detail.statusTitle', 'Move {{key}} to “{{status}}”?', {
            key: current.key,
            status: statusLabel(patch.status)
          }),
          description: translate(
            'buildWeb.detail.statusJira',
            'build-web mirrors the move to Jira {{jira}}.',
            { jira: current.jira_key }
          ),
          confirmLabel: translate('buildWeb.detail.move', 'Move')
        })
        if (!accepted) {
          return
        }
      }
      const optimistic = patch.status === undefined
      if (optimistic) {
        setDetail({ ...current, ...patch })
      }
      setSaving(true)
      try {
        const result = await callBuildWeb(target, 'updateIssue', { id: current.id, patch })
        if (!result.ok) {
          setDetail(current)
          toast.error(result.error)
          return
        }
        if (result.value.issue) {
          setDetail((shown) => (shown ? { ...shown, ...result.value.issue } : shown))
          patchRow(current.id, result.value.issue)
        }
        if (patch.status && result.value.jira) {
          toast.message(
            translate('buildWeb.detail.jiraResult', 'Jira: {{result}}', {
              result: result.value.jira
            })
          )
        }
      } catch (failure) {
        setDetail(current)
        toast.error(failure instanceof Error ? failure.message : String(failure))
      } finally {
        setSaving(false)
      }
    },
    [confirm, detail, patchRow, saving, target]
  )

  return { detail, error, assignees, versions, saving, save, reload: () => void load() }
}
