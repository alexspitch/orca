import {
  BUILD_WEB_ASSIGNEE_ME,
  BUILD_WEB_UNASSIGNED,
  type BuildWebIssueQuery,
  type BuildWebUser
} from '../../../../shared/build-web-types'

export type AssigneeFilterOption = { value: string; user?: BuildWebUser }

/**
 * The assignee filter's choices: Mine and nobody first, then the console's people. A ticked value
 * the console no longer lists (a saved query's) stays, so it can be unticked.
 */
export function assigneeFilterOptions(
  users: readonly BuildWebUser[],
  /** The viewer's login, left out of the people since Mine names them. */
  me: string | null,
  selected: ReadonlySet<string>
): { own: AssigneeFilterOption[]; people: AssigneeFilterOption[] } {
  const own: AssigneeFilterOption[] = [
    { value: BUILD_WEB_ASSIGNEE_ME },
    { value: BUILD_WEB_UNASSIGNED }
  ]
  const mine = me?.toLowerCase()
  const people: AssigneeFilterOption[] = users
    .map((user) => ({ value: user.email.toLowerCase(), user }))
    .filter((option) => option.value !== mine)
  const known = new Set([...own, ...people].map((option) => option.value))
  for (const value of selected) {
    if (!known.has(value)) {
      people.push({ value })
    }
  }
  return { own, people }
}

/**
 * The filter as the console reads it. Mine alone is its `mine` flag: the console knows the token's
 * owner, and an Orca server older than the assignee filter passes the flag on. With others, Mine is
 * the viewer's login, in lower case as the console keeps it; sorted, the same choice is one request.
 */
export function assigneeFilterQuery(
  assignees: ReadonlySet<string>,
  me: string | null
): Pick<BuildWebIssueQuery, 'mine' | 'assignee'> {
  if (assignees.size === 1 && assignees.has(BUILD_WEB_ASSIGNEE_ME)) {
    return { mine: true }
  }
  const values = new Set<string>()
  for (const value of assignees) {
    if (value !== BUILD_WEB_ASSIGNEE_ME) {
      values.add(value)
    } else if (me) {
      values.add(me.toLowerCase())
    }
  }
  return { mine: false, ...(values.size ? { assignee: [...values].sort() } : {}) }
}
