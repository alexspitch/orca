import { beforeEach, describe, expect, it } from 'vitest'
import type { BuildWebRecap } from '../../../../../shared/build-web-recap-types'
import {
  backIndex,
  forwardIndex,
  labelIssuePage,
  recentPages,
  recordPage,
  usePageHistory,
  withoutPageRecording,
  type PageEntry
} from './page-history-store'

const recap = (id: string): BuildWebRecap => ({
  id,
  automation_id: 'a',
  name: `Report ${id}`,
  product: 'sa',
  version: null,
  commit: null,
  trigger: 'scheduled',
  started_by: null,
  finished_at: '2026-10-21T06:00:00Z'
})

const card = (issueId: string, over: Partial<Extract<PageEntry, { kind: 'issue' }>> = {}) =>
  ({
    kind: 'issue',
    view: 'build-web',
    issueId,
    label: null,
    fullScreen: true,
    fullScreenFromDrawer: false,
    tab: 'overview',
    ...over
  }) as const

const keys = () =>
  usePageHistory
    .getState()
    .entries.map((e) =>
      e.kind === 'view' ? e.view : e.kind === 'issue' ? `${e.issueId}:${e.tab}` : e.recap.id
    )

beforeEach(() => {
  usePageHistory.setState({ entries: [], index: -1, shownRecap: null })
})

describe('the page history', () => {
  it('records pages in order, a page shown again updated in place', () => {
    recordPage({ kind: 'view', view: 'build-web-recaps' })
    recordPage({ kind: 'recap', recap: recap('r1') })
    recordPage(card('i1'))
    recordPage(card('i1', { tab: 'plan' }))
    expect(keys()).toEqual(['build-web-recaps', 'r1', 'i1:plan'])
    expect(usePageHistory.getState().index).toBe(2)
  })

  it('starts a new branch from a page gone back to, as a browser does', () => {
    recordPage({ kind: 'view', view: 'build-web' })
    recordPage(card('i1'))
    recordPage(card('i2'))
    usePageHistory.setState({ index: 0 })
    recordPage({ kind: 'view', view: 'build-web-images' })
    expect(keys()).toEqual(['build-web', 'build-web-images'])
  })

  it('records nothing a link opens on its own behalf', () => {
    withoutPageRecording(() => recordPage({ kind: 'view', view: 'build-web' }))
    expect(keys()).toEqual([])
  })

  it('goes back to the page left when away from build-web, else to the page before', () => {
    recordPage({ kind: 'view', view: 'build-web-recaps' })
    recordPage(card('i1'))
    const state = usePageHistory.getState()
    expect(backIndex(state, true)).toBe(0)
    expect(backIndex(state, false)).toBe(1)
    expect(forwardIndex(state)).toBeNull()
    expect(forwardIndex({ ...state, index: 0 })).toBe(1)
  })

  it('lists the last ten pages, each once and the newest first', () => {
    for (let i = 0; i < 12; i++) {
      recordPage(card(`i${i}`))
      recordPage({ kind: 'view', view: 'build-web' })
    }
    const recent = recentPages(usePageHistory.getState())
    expect(recent).toHaveLength(10)
    expect(recent[0].entry).toEqual({ kind: 'view', view: 'build-web' })
    expect(recent.slice(1, 3).map((r) => r.entry.kind === 'issue' && r.entry.issueId)).toEqual([
      'i11',
      'i10'
    ])
  })

  it('names a card once its task is read, and keeps the name when the card is shown again', () => {
    recordPage(card('i1'))
    labelIssuePage('i1', 'IS-1 · Calls drop')
    recordPage(card('i1', { tab: 'build' }))
    const [entry] = usePageHistory.getState().entries
    expect(entry.kind === 'issue' && entry.label).toBe('IS-1 · Calls drop')
  })
})
