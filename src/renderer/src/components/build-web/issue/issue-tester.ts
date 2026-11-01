import type {
  BuildWebIssueRow,
  BuildWebTester,
  BuildWebUserRole
} from '../../../../../shared/build-web-types'
import type { BuildWebTestingStatus } from '../../../../../shared/build-web-run-types'

// IS-347: the card's «Tester» row, after build-web's tester.ts. The console settles the value; this
// only says which check the task is in and whom to offer. No renderer aliases: mobile imports it.

export type TesterKind = 'testing' | 'external' | 'self'

/** A person known only from Jira: `jira:<accountId>`, no e-mail. */
export const isJiraLogin = (who: string): boolean => who.startsWith('jira:')

/** By the status while under check, else by «After the train». Null: nobody accepts it. */
export function testerKindOf(
  issue: Pick<BuildWebIssueRow, 'status' | 'parent_id'>,
  afterTrain: BuildWebTestingStatus
): TesterKind | null {
  if (issue.parent_id || issue.status === 'done' || issue.status === 'wontfix') {
    return null
  }
  const check =
    issue.status === 'testing'
      ? 'Testing'
      : issue.status === 'testing_external'
        ? 'TESTING_EXTERNAL'
        : issue.status === 'self_testing'
          ? 'SELF_TESTING'
          : afterTrain
  switch (check) {
    case 'Testing':
      return 'testing'
    case 'TESTING_EXTERNAL':
      return 'external'
    case 'SELF_TESTING':
      return 'self'
    case 'Done':
      return null
  }
}

const ROLES_OF: Record<Exclude<TesterKind, 'self'>, readonly BuildWebUserRole[]> = {
  testing: ['tester'],
  external: ['ps_engineer', 'analyst']
}

/** Whom the console puts there by default: the product's tester, the Jira creator, the assignee. */
export function defaultTesterOf(
  kind: TesterKind | null,
  issue: Pick<BuildWebIssueRow, 'product' | 'assignee' | 'jira_author'>,
  people: readonly BuildWebTester[]
): string {
  if (kind === 'self') {
    return issue.assignee
  }
  if (kind === 'testing') {
    const own = people.find((p) =>
      p.default_tester_for.some((product) => product === issue.product)
    )
    return own?.email || issue.assignee
  }
  return kind === 'external' ? (issue.jira_author ?? '') : ''
}

/** The picker's people: the kind's roles, the current tester and the default, by name. */
export function testerChoices(
  kind: TesterKind | null,
  issue: Pick<BuildWebIssueRow, 'product' | 'assignee' | 'jira_author' | 'tester'>,
  people: readonly BuildWebTester[],
  label: (who: string) => string
): { value: string; label: string }[] {
  if (!kind || kind === 'self') {
    return []
  }
  const wanted = ROLES_OF[kind]
  const logins = new Set(
    people.filter((p) => p.roles.some((r) => wanted.includes(r))).map((p) => p.email)
  )
  for (const always of [issue.tester ?? '', defaultTesterOf(kind, issue, people)]) {
    if (always) {
      logins.add(always)
    }
  }
  return [...logins]
    .map((value) => ({ value, label: label(value) }))
    .sort((a, b) => a.label.localeCompare(b.label))
}
