import { BUILD_WEB_UNASSIGNED, type BuildWebUser } from '../../../../shared/build-web-types'

export type AssigneeFilterOption = { value: string; user?: BuildWebUser }

/**
 * The assignee filter's choices: the viewer and nobody first, then the console's people. A ticked
 * value the console no longer lists (a saved query's) stays, so it can be unticked.
 */
export function assigneeFilterOptions(
  users: readonly BuildWebUser[],
  /** The viewer's login, lower case as the console keeps it. */
  me: string | null,
  selected: ReadonlySet<string>
): { own: AssigneeFilterOption[]; people: AssigneeFilterOption[] } {
  const own: AssigneeFilterOption[] = [
    ...(me ? [{ value: me }] : []),
    { value: BUILD_WEB_UNASSIGNED }
  ]
  const people: AssigneeFilterOption[] = users
    .map((user) => ({ value: user.email.toLowerCase(), user }))
    .filter((option) => option.value !== me)
  const known = new Set([...own, ...people].map((option) => option.value))
  for (const value of selected) {
    if (!known.has(value)) {
      people.push({ value })
    }
  }
  return { own, people }
}
