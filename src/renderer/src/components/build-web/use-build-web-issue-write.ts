import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import type {
  BuildWebIssuePatch,
  BuildWebIssueRow,
  BuildWebJiraOutcome
} from '../../../../shared/build-web-types'
import { useConfirmationDialog } from '@/components/confirmation-dialog-context'
import { translate } from '@/i18n/i18n'
import { callBuildWeb } from './build-web-client'
import { useBuildWebStore } from './build-web-store'
import { useBuildWebTarget } from './use-build-web-data'
import { statusLabel } from './build-web-labels'

// Field writes shared by the card and the table: a status move asks first when the task has a Jira
// ticket (build-web mirrors it there), and what Jira did is shown, never assumed.

/** Resolves false when the person declined a status move that Jira would mirror. */
export function useConfirmStatusMove(): (
  issue: Pick<BuildWebIssueRow, 'key' | 'jira_key'>,
  patch: BuildWebIssuePatch
) => Promise<boolean> {
  const confirm = useConfirmationDialog()
  return useCallback(
    async (issue, patch) => {
      if (!patch.status || !issue.jira_key) {
        return true
      }
      return confirm({
        title: translate('buildWeb.detail.statusTitle', 'Move {{key}} to “{{status}}”?', {
          key: issue.key,
          status: statusLabel(patch.status)
        }),
        description: translate(
          'buildWeb.detail.statusJira',
          'build-web mirrors the move to Jira {{jira}}.',
          { jira: issue.jira_key }
        ),
        confirmLabel: translate('buildWeb.detail.move', 'Move')
      })
    },
    [confirm]
  )
}

export function toastJiraOutcome(
  patch: BuildWebIssuePatch,
  jira: BuildWebJiraOutcome | null
): void {
  if (!patch.status || !jira) {
    return
  }
  if (jira.ok) {
    toast.message(
      translate('buildWeb.detail.jiraMoved', 'Jira: {{status}}', { status: jira.status })
    )
  } else {
    toast.error(
      translate('buildWeb.detail.jiraNotMoved', 'Not moved in Jira: {{error}}', {
        error: jira.error
      })
    )
  }
}

/**
 * A field change from a list row. The priority and the assignee show at once; the status only once the console
 * took it, because it moves Jira too. `busy` holds the ids being written.
 */
export function useIssueRowPatch(): {
  busy: ReadonlySet<string>
  patch: (issue: BuildWebIssueRow, patch: BuildWebIssuePatch) => Promise<void>
} {
  const { target } = useBuildWebTarget()
  const confirmStatusMove = useConfirmStatusMove()
  const patchRow = useBuildWebStore((s) => s.patchIssue)
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set())
  const patch = useCallback(
    async (issue: BuildWebIssueRow, change: BuildWebIssuePatch) => {
      if (!(await confirmStatusMove(issue, change))) {
        return
      }
      const before: Partial<BuildWebIssueRow> = {
        status: issue.status,
        priority: issue.priority,
        assignee: issue.assignee
      }
      if (change.status === undefined) {
        patchRow(issue.id, change)
      }
      setBusy((ids) => new Set(ids).add(issue.id))
      try {
        const result = await callBuildWeb(target, 'updateIssue', { id: issue.id, patch: change })
        if (!result.ok) {
          patchRow(issue.id, before)
          toast.error(result.error)
          return
        }
        patchRow(issue.id, result.value.issue ?? change)
        toastJiraOutcome(change, result.value.jira)
      } catch (failure) {
        patchRow(issue.id, before)
        toast.error(failure instanceof Error ? failure.message : String(failure))
      } finally {
        setBusy((ids) => {
          const next = new Set(ids)
          next.delete(issue.id)
          return next
        })
      }
    },
    [confirmStatusMove, patchRow, target]
  )
  return { busy, patch }
}
