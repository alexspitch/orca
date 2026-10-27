import { describe, expect, it } from 'vitest'
import type { BuildWebWatchEntry } from '../../../../../shared/build-web-watch-types'
import type { Cell } from '../issue/build/run-cells'
import {
  autoKindOf,
  jiraStatusShown,
  sortWatchEntries,
  taskStatusOf,
  workCells,
  workChips,
  workTotal
} from './testing-rows'

function entry(patch: Partial<BuildWebWatchEntry>): BuildWebWatchEntry {
  return {
    ticket: 'SDAP-1',
    status: 'Testing',
    status_changed_at: '2026-10-01T00:00:00Z',
    checked_at: null,
    last_action: null,
    last_action_at: null,
    issue_id: null,
    issue_key: null,
    run: null,
    jira_key: 'SDAP-1',
    jira_url: null,
    title: null,
    task_status: null,
    jira_status: null,
    auto: null,
    armed: null,
    ...patch
  }
}

const run = (pending: number, unpushed: number, main_tag_left = 0, in_flight = 0) => ({
  id: 'r',
  branch: 'master',
  created_at: '',
  pending,
  unpushed,
  main_tag_left,
  in_flight,
  console_url: null
})

describe('the work column', () => {
  it('names each kind of work left, and nothing for a kind with none', () => {
    expect(workChips(run(2, 0, 3, 1))).toEqual([
      { kind: 'build', count: 2 },
      { kind: 'tag', count: 3 },
      { kind: 'flight', count: 1 }
    ])
    expect(workChips(null)).toEqual([])
    expect(workTotal(run(2, 1, 3, 1))).toBe(7)
  })

  it('sorts by the number of images, not as text', () => {
    const rows = [
      entry({ ticket: 'A', run: run(0, 10) }),
      entry({ ticket: 'B', run: run(0, 2) }),
      entry({ ticket: 'C' })
    ]
    expect(sortWatchEntries(rows, 'work', 'desc').map((e) => e.ticket)).toEqual(['A', 'B', 'C'])
    expect(sortWatchEntries(rows, 'work', 'asc').map((e) => e.ticket)).toEqual(['C', 'B', 'A'])
  })
})

describe('sorting', () => {
  it('keeps the console order until a column is picked, and compares keys by their number', () => {
    const rows = [entry({ ticket: 'SDAP-400' }), entry({ ticket: 'SDAP-3931' })]
    expect(sortWatchEntries(rows, null, 'asc').map((e) => e.ticket)).toEqual([
      'SDAP-400',
      'SDAP-3931'
    ])
    expect(sortWatchEntries(rows, 'task', 'desc').map((e) => e.ticket)).toEqual([
      'SDAP-3931',
      'SDAP-400'
    ])
  })
})

describe('statuses', () => {
  it('shows the Jira status beside the task only when they disagree', () => {
    expect(jiraStatusShown(entry({ task_status: 'testing', jira_status: 'Testing' }))).toBeNull()
    expect(
      jiraStatusShown(
        entry({
          task_status: 'testing_external',
          jira_status: 'TESTING_EXTERNAL'
        })
      )
    ).toBeNull()
    expect(
      jiraStatusShown(entry({ task_status: 'inprogress', jira_status: 'TESTING_EXTERNAL' }))
    ).toBe('TESTING_EXTERNAL')
    // An older console sends no status of its own: the watched Jira status is all there is.
    expect(jiraStatusShown(entry({ status: 'TESTING_EXTERNAL' }))).toBe('TESTING_EXTERNAL')
    expect(jiraStatusShown(entry({ jira_key: null, task_status: 'testing' }))).toBeNull()
  })

  it('reads the console status, unknown kept apart from absent', () => {
    expect(taskStatusOf(entry({ task_status: 'testing_external' }))).toBe('testing_external')
    expect(taskStatusOf(entry({ task_status: 'reviewing' }))).toBe('unknown')
    expect(taskStatusOf(entry({}))).toBeNull()
  })
})

describe('auto-publish', () => {
  it('tells who publishes on Done, and a ticket the watcher has not taken yet', () => {
    expect(autoKindOf(entry({ auto: 'jira', armed: true }))).toBe('jira')
    expect(autoKindOf(entry({ auto: 'jira', armed: false }))).toBe('next')
    expect(autoKindOf(entry({ auto: 'console' }))).toBe('console')
    expect(autoKindOf(entry({ auto: 'none' }))).toBe('off')
    expect(autoKindOf(entry({}))).toBeNull()
  })
})

describe('workCells', () => {
  const cell = (image: string, patch: Partial<Cell>): Cell => ({
    image,
    dist: 'rhel',
    branch: 'origin/dc-release-3.0',
    state: 'done',
    number: 1,
    url: null,
    status: 'SUCCESS',
    tags: [`docker.spitch.ch/${image}:3.0b1`, `docker.spitch.ch/${image}:3.0`],
    pushed: false,
    mainTagSkipped: false,
    skippedTags: [],
    startedAt: null,
    testsSkipped: false,
    twin: null,
    note: null,
    twinOfNumber: null,
    ...patch
  })
  const cells = [
    cell('dc/never', { state: 'pending', status: null, tags: [] }),
    cell('dc/built', {}),
    cell('dc/tag', { pushed: true, mainTagSkipped: true }),
    cell('dc/going', { state: 'building', status: null }),
    cell('dc/out', { pushed: true }),
    cell('dc/broken', { status: 'FAILURE' }),
    // IS-230: twins are the console's: a push of their rhel row publishes them.
    cell('dc/twin-wait', { dist: 'redos', twin: 'full', state: 'pending', status: null }),
    cell('dc/twin-out', { dist: 'redos', twin: 'derive' }),
    cell('dc/twin-tag', { dist: 'redos', twin: 'derive', pushed: true, mainTagSkipped: true })
  ]
  const images = (kind: Parameters<typeof workCells>[1]) =>
    workCells(cells, kind).map((c) => c.image)

  it('picks the rows each chip stands for, as the console counts them', () => {
    expect(images('build')).toEqual(['dc/never'])
    expect(images('push')).toEqual(['dc/built'])
    expect(images('tag')).toEqual(['dc/tag'])
    expect(images('flight')).toEqual(['dc/going'])
  })
})
