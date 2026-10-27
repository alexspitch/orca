import { useCallback, useState } from 'react'
import type {
  BuildWebIssuePatch,
  BuildWebIssueRow,
  BuildWebJiraOutcome
} from '../../../../src/shared/build-web-types'
import { statusLabel } from '../build-web-labels'
import { buildWebErrorMessage } from '../build-web-operations'
import { useBuildWebScreen, type BuildWebScreen } from '../build-web-screen-context'
import type { IssueList } from './use-issue-list'
import { useConfirmPrompt } from './use-confirm-prompt'

// The desktop's row writes (use-build-web-issue-write's useIssueRowPatch, BuildWebPage's
// toggleFavorite): a status move asks first when Jira mirrors it, and what Jira did is shown.

function notifyJiraOutcome(
  notify: BuildWebScreen['notify'],
  patch: BuildWebIssuePatch,
  jira: BuildWebJiraOutcome | null
): void {
  if (!patch.status || !jira) {
    return
  }
  if (jira.ok) {
    notify(`Jira: ${jira.status}`)
  } else {
    notify(`Not moved in Jira: ${jira.error}`, 'error')
  }
}

/**
 * The priority and the assignee show at once; the status only once the console took it, because
 * it moves Jira too. `busy` holds the ids being written.
 */
export function useIssueRowActions(list: Pick<IssueList, 'patchIssue'>) {
  const { call, notify } = useBuildWebScreen()
  const { confirm, element: confirmElement } = useConfirmPrompt()
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set())
  const { patchIssue } = list

  const patch = useCallback(
    async (issue: BuildWebIssueRow, change: BuildWebIssuePatch) => {
      if (change.status && issue.jira_key) {
        const accepted = await confirm({
          title: `Move ${issue.key} to “${statusLabel(change.status)}”?`,
          message: `build-web mirrors the move to Jira ${issue.jira_key}.`,
          confirmLabel: 'Move'
        })
        if (!accepted) {
          return
        }
      }
      const before: Partial<BuildWebIssueRow> = {
        status: issue.status,
        priority: issue.priority,
        assignee: issue.assignee
      }
      if (change.status === undefined) {
        patchIssue(issue.id, change)
      }
      setBusy((ids) => new Set(ids).add(issue.id))
      try {
        const result = await call('updateIssue', { id: issue.id, patch: change })
        if (!result.ok) {
          patchIssue(issue.id, before)
          notify(result.error, 'error')
          return
        }
        patchIssue(issue.id, result.value.issue ?? change)
        notifyJiraOutcome(notify, change, result.value.jira)
      } catch (failure) {
        patchIssue(issue.id, before)
        notify(buildWebErrorMessage(failure), 'error')
      } finally {
        setBusy((ids) => {
          const next = new Set(ids)
          next.delete(issue.id)
          return next
        })
      }
    },
    [call, confirm, notify, patchIssue]
  )

  const toggleFavorite = useCallback(
    async (issue: BuildWebIssueRow) => {
      const on = !issue.favorite
      patchIssue(issue.id, { favorite: on })
      const result = await call('setFavorite', { id: issue.id, on }).catch((failure: unknown) => ({
        ok: false as const,
        error: buildWebErrorMessage(failure)
      }))
      if (!result.ok) {
        patchIssue(issue.id, { favorite: !on })
        notify(result.error, 'error')
      }
    },
    [call, notify, patchIssue]
  )

  return { busy, patch, toggleFavorite, confirmElement }
}
