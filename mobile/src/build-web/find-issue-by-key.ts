import type { BuildWebIssueRow } from '../../../src/shared/build-web-types'
import type { BuildWebScreen } from './build-web-screen-context'

/** The task a number names: build-web's own number, or the Jira number of a task linked to Jira. */
export async function findIssueByKey(
  call: BuildWebScreen['call'],
  key: string
): Promise<BuildWebIssueRow | undefined> {
  // Why the families: a subtask's number is found under its parent.
  const page = await call('listIssues', { view: 'all', q: key, limit: 20, offset: 0, tree: true })
  return page.issues.find((row) => row.key === key || row.jira_key === key)
}
