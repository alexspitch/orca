import type {
  BuildWebIssuePatch,
  BuildWebIssueRow,
  BuildWebJiraOutcome
} from '../../../../src/shared/build-web-types'
import { BUILD_WEB_PRODUCT_CP_RUNTIME_CAPABILITY } from '../../../../src/shared/build-web-capability'
import { statusLabel } from '../build-web-labels'
import type { BuildWebScreen } from '../build-web-screen-context'
import type { IssueConfirm } from './use-issue-confirm'

// Field writes shared by the card and its subtasks: a status move asks first when the task has a
// Jira ticket (build-web mirrors it there), and what Jira did is shown, never assumed.

/** Resolves false when the person declined a status move that Jira would mirror. */
export function confirmStatusMove(
  confirm: IssueConfirm,
  issue: Pick<BuildWebIssueRow, 'key' | 'jira_key'>,
  patch: BuildWebIssuePatch
): Promise<boolean> {
  if (!patch.status || !issue.jira_key) {
    return Promise.resolve(true)
  }
  return confirm({
    title: `Move ${issue.key} to “${statusLabel(patch.status)}”?`,
    message: `build-web mirrors the move to Jira ${issue.jira_key}.`,
    confirmLabel: 'Move'
  })
}

export function notifyJiraOutcome(
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

/** Why the host would refuse this patch, as the desktop client says before calling an older server. */
export function patchRefusal(
  hostCapabilities: readonly string[],
  patch: BuildWebIssuePatch
): string | null {
  if (
    patch.product === 'cp' &&
    !hostCapabilities.includes(BUILD_WEB_PRODUCT_CP_RUNTIME_CAPABILITY)
  ) {
    return 'This Orca server does not know Chat Platform yet. Update the server.'
  }
  return null
}
