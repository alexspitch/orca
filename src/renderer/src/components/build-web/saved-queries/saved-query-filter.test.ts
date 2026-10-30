import { describe, expect, it } from 'vitest'
import { EMPTY_BUILD_WEB_SAVED_FILTER } from '../../../../../shared/build-web-saved-query-types'
import { BUILD_WEB_ASSIGNEE_ME } from '../../../../../shared/build-web-types'
import { savedFilterOfView, storageProductOf, viewOfSavedFilter } from './saved-query-filter'

describe('saved queries of the Issues list', () => {
  it('saves the list as the console keeps it, leaving the archive out', () => {
    expect(
      savedFilterOfView(
        {
          quick: new Set(['jira', 'archived'] as const),
          statuses: new Set(['testing', 'todo'] as const),
          products: new Set(['dc'] as const),
          assignees: new Set(['none', BUILD_WEB_ASSIGNEE_ME]),
          query: '  IS-12 '
        },
        'Me@Spitch.ch'
      )
    ).toEqual({
      ...EMPTY_BUILD_WEB_SAVED_FILTER,
      q: 'IS-12',
      product: ['dc'],
      assignee: ['me@spitch.ch', 'none'],
      status: ['todo', 'testing'],
      jira: ['yes']
    })
  })

  it('reads back what it saved, with nothing left over', () => {
    const view = {
      quick: new Set(['ai', 'favorite'] as const),
      statuses: new Set(['inprogress'] as const),
      products: new Set(['dc', 'sa'] as const),
      assignees: new Set(['none']),
      query: 'deploy'
    }
    expect(viewOfSavedFilter(savedFilterOfView(view, 'me@spitch.ch'))).toEqual({
      quick: ['ai', 'favorite'],
      statuses: ['inprogress'],
      products: ['sa', 'dc'],
      assignees: ['none'],
      query: 'deploy',
      unsupported: []
    })
  })

  it('names what the console narrows by and Orca does not', () => {
    const applied = viewOfSavedFilter({
      ...EMPTY_BUILD_WEB_SAVED_FILTER,
      product: ['dc', 'sa'],
      assignee: ['me@spitch.ch'],
      type: ['bug'],
      jira: ['no'],
      from: '2026-09-01',
      rootOnly: true,
      status: ['testing', 'nonsense']
    })
    expect(applied.products).toEqual(['sa', 'dc'])
    expect(applied.assignees).toEqual(['me@spitch.ch'])
    expect(applied.statuses).toEqual(['testing'])
    expect(applied.quick).toEqual([])
    expect(applied.unsupported).toEqual(['type', 'jira', 'dates', 'rootOnly'])
  })

  it('keeps Mine alone as the console’s Mine, so a shared query means each reader’s tasks', () => {
    const view = {
      quick: new Set<'ai'>(),
      statuses: new Set<'todo'>(),
      products: new Set<'dc'>(),
      assignees: new Set([BUILD_WEB_ASSIGNEE_ME]),
      query: ''
    }
    const saved = savedFilterOfView(view, 'me@spitch.ch')
    expect(saved).toMatchObject({ mine: true, assignee: [] })
    expect(viewOfSavedFilter(saved).assignees).toEqual([BUILD_WEB_ASSIGNEE_ME])
    // The console ANDs its Mine with assignees; the list ORs them, so Mine stands and the rest is named.
    const both = viewOfSavedFilter({ ...saved, assignee: ['oleg@spitch.ch'] })
    expect(both.assignees).toEqual([BUILD_WEB_ASSIGNEE_ME])
    expect(both.unsupported).toEqual(['assignee'])
  })
})

describe('where the console files a saved query', () => {
  it('under its own product, else under a fixed one', () => {
    expect(storageProductOf({ ...EMPTY_BUILD_WEB_SAVED_FILTER, product: ['sa'] })).toBe('sa')
    expect(storageProductOf(EMPTY_BUILD_WEB_SAVED_FILTER)).toBe('dc')
    expect(storageProductOf({ ...EMPTY_BUILD_WEB_SAVED_FILTER, product: ['sa', 'ap'] })).toBe('dc')
  })
})
