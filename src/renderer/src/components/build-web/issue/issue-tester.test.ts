import { describe, expect, it } from 'vitest'
import type { BuildWebTester } from '../../../../../shared/build-web-types'
import { testerChoices, testerKindOf } from './issue-tester'

const person = (
  email: string,
  roles: BuildWebTester['roles'],
  default_tester_for: BuildWebTester['default_tester_for'] = []
): BuildWebTester => ({ email, name: email.toUpperCase(), roles, default_tester_for })

const PEOPLE = [
  person('qa@x.test', ['tester']),
  person('alexey.korotkov@x.test', ['tester'], ['dc']),
  person('ps@x.test', ['ps_engineer']),
  person('an@x.test', ['analyst', 'developer']),
  person('dev@x.test', ['developer']),
  person('jira:77', ['tester'])
]

const task = {
  status: 'inprogress' as const,
  parent_id: null,
  product: 'dc' as const,
  assignee: 'dev@x.test',
  jira_author: 'jira:5b',
  tester: ''
}

describe('task tester', () => {
  it('takes the kind of check from the status, else from «After the train»', () => {
    expect(testerKindOf(task, 'Testing')).toBe('testing')
    expect(testerKindOf(task, 'SELF_TESTING')).toBe('self')
    expect(testerKindOf(task, 'TESTING_EXTERNAL')).toBe('external')
    expect(testerKindOf(task, 'Done')).toBeNull()
    expect(testerKindOf({ ...task, status: 'self_testing' }, 'Testing')).toBe('self')
    expect(testerKindOf({ ...task, status: 'testing_external' }, 'Done')).toBe('external')
    expect(testerKindOf({ ...task, status: 'done' }, 'Testing')).toBeNull()
    expect(testerKindOf({ ...task, parent_id: 'p' }, 'Testing')).toBeNull()
  })

  it('offers testers for a check, PS engineers and analysts for an external one', () => {
    const label = (who: string) => who
    expect(testerChoices('testing', task, PEOPLE, label).map((o) => o.value)).toEqual([
      'alexey.korotkov@x.test',
      'jira:77',
      'qa@x.test'
    ])
    // The current tester and the console's default are offered whatever their roles.
    expect(
      testerChoices('external', { ...task, tester: 'dev@x.test' }, PEOPLE, label).map(
        (o) => o.value
      )
    ).toEqual(['an@x.test', 'dev@x.test', 'jira:5b', 'ps@x.test'])
    expect(testerChoices('self', task, PEOPLE, label)).toEqual([])
  })
})
