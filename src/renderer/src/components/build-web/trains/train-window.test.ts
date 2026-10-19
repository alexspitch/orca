import { describe, expect, it } from 'vitest'
import type {
  BuildWebTrainAction,
  BuildWebTrainRun
} from '../../../../../shared/build-web-train-types'
import { isProblem, windowReport, windowSummary } from './train-window'
import { trainActionLine } from './train-action-line'

// After build-web's train-window and train-action-line tests: a window read from its row and its
// journal, and the journal's rows in words.

function run(extra: Partial<BuildWebTrainRun> = {}): BuildWebTrainRun {
  return {
    id: 'w1',
    build_run_id: null,
    window_at: '2026-10-18T09:00:00Z',
    status: 'done',
    images: [],
    tickets: [],
    error: null,
    updated_at: '2026-10-18T09:30:00Z',
    built: 0,
    problems: 0,
    live_builds: [],
    ...extra
  }
}

function action(extra: Partial<BuildWebTrainAction>): BuildWebTrainAction {
  return {
    id: Math.random().toString(36),
    at: '2026-10-18T09:10:00Z',
    kind: 'build',
    target: '',
    detail: {},
    outcome: null,
    error: null,
    ...extra
  }
}

describe('a window, read', () => {
  it('names a failed build as failed, never as built', () => {
    const failed = action({
      target: 'dc/x (rhel)',
      outcome: 'FAILURE',
      detail: { build_number: 11830, tags: ['r/dc/x:3.1b11830'] }
    })
    expect(trainActionLine(failed)).toBe('build failed: dc/x (rhel) #11830')
    const report = windowReport(
      run({
        images: [
          {
            image: 'dc/x',
            dist: 'rhel',
            why: ['IS-1'],
            tickets: [],
            current: null,
            publish: false,
            held: null
          }
        ]
      }),
      [failed]
    )
    expect(report.images[0]).toMatchObject({ state: 'failed', build_number: 11830, tags: [] })
    expect(report.problems).toEqual([])
  })

  it('keeps an image the tasks’ commits are already in, and shows a build still going', () => {
    const report = windowReport(
      run({
        status: 'building',
        images: [
          {
            image: 'dc/a',
            dist: 'rhel',
            why: [],
            tickets: [],
            current: { build_number: 7, image_tags: ['r/dc/a:1b7'], pushed: null },
            publish: false,
            held: null
          },
          {
            image: 'dc/b',
            dist: 'rhel',
            why: ['IS-2'],
            tickets: [],
            current: null,
            publish: false,
            held: null
          }
        ],
        live_builds: [
          {
            image: 'dc/b',
            dist: 'rhel',
            status: 'building',
            build_number: 9,
            build_url: 'https://ci/9'
          }
        ]
      }),
      []
    )
    expect(report.images.map((i) => i.state)).toEqual(['kept', 'building'])
  })

  it('tells a reason to leave a task alone from an error', () => {
    expect(isProblem(action({ kind: 'ticket_skipped', error: 'no commits' }))).toBe(false)
    expect(isProblem(action({ kind: 'ticket_skipped', error: 'refused', outcome: 'retry' }))).toBe(
      true
    )
    expect(isProblem(action({ kind: 'deploy', error: 'ssh failed' }))).toBe(true)
  })

  it('says a pending task of an ended window was not moved', () => {
    const report = windowReport(
      run({
        tickets: [
          {
            key: 'SDAP-1',
            issue_id: 'id-1',
            summary: 'x',
            outcome: 'pending',
            from: null,
            to: null,
            reason: null,
            attempts: 0,
            waiting: []
          }
        ]
      }),
      []
    )
    expect(report.tickets[0]).toMatchObject({ label: 'not moved', issueId: 'id-1' })
  })

  it('sums a window up in one line', () => {
    const summary = windowSummary(
      run({
        built: 1,
        problems: 2,
        images: [
          {
            image: 'a',
            dist: 'rhel',
            why: [],
            tickets: [],
            current: null,
            publish: false,
            held: null
          },
          {
            image: 'b',
            dist: 'rhel',
            why: [],
            tickets: [],
            current: { build_number: 1, image_tags: [], pushed: null },
            publish: false,
            held: null
          }
        ]
      })
    )
    expect(summary).toBe('built 1 of 1, not rebuilt 1, errors 2')
  })

  it('says whether each image is in the registry, from the build run first, then the journal', () => {
    const image = (name: string, over: Record<string, unknown> = {}) => ({
      image: name,
      dist: 'rhel',
      why: [],
      tickets: [],
      current: null,
      publish: false,
      held: null,
      ...over
    })
    const built = (name: string) =>
      action({
        target: `${name} (rhel)`,
        outcome: 'SUCCESS',
        detail: { build_number: 1, tags: [] }
      })
    const report = windowReport(
      run({
        status: 'building',
        images: [
          image('a'),
          image('b'),
          image('c'),
          image('d'),
          image('k', { current: { build_number: 3, image_tags: [], pushed: true } })
        ],
        // A build finished by the console while the journal was last read.
        live_builds: [
          { image: 'd', dist: 'rhel', status: 'SUCCESS', build_number: 4, build_url: null }
        ]
      }),
      [
        built('a'),
        built('b'),
        built('c'),
        action({ kind: 'push', target: 'c (rhel)', outcome: 'published' })
      ],
      new Map([
        ['a (rhel)', true],
        ['b (rhel)', false],
        ['d (rhel)', true]
      ])
    )
    expect(report.images.map((i) => [i.target, i.state, i.pushed])).toEqual([
      ['a (rhel)', 'built', true],
      ['b (rhel)', 'built', false],
      ['c (rhel)', 'built', true],
      ['d (rhel)', 'built', true],
      ['k (rhel)', 'kept', true]
    ])
  })

  it('holds an image the daily run found red, and says so in the journal', () => {
    const report = windowReport(
      run({
        images: [
          {
            image: 'dc/x',
            dist: 'rhel',
            why: [],
            tickets: [],
            current: null,
            publish: false,
            held: { workspace: 'packages/a', red_commit: 'abcdef1234567', first_suspect: null }
          }
        ]
      }),
      []
    )
    expect(report.images[0]).toMatchObject({
      state: 'held',
      note: 'held: red tests in packages/a since abcdef1234'
    })
    const held = action({
      kind: 'image_held',
      target: 'dc/x (rhel)',
      detail: { workspace: 'packages/a', tickets: ['SDAP-1'] }
    })
    expect(trainActionLine(held)).toBe('dc/x (rhel) held: red tests in packages/a, SDAP-1 wait')
    expect(isProblem(held)).toBe(false)
  })
})
