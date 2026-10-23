import { describe, expect, it } from 'vitest'
import { EMPTY_BUILD_WEB_SAVED_FILTER } from '../../../../../shared/build-web-saved-query-types'
import { savedFilterOfView, storageProductOf, viewOfSavedFilter } from './saved-query-filter'

describe('saved queries of the Issues list', () => {
  it('saves the list as the console keeps it, leaving the archive out', () => {
    expect(
      savedFilterOfView({
        quick: new Set(['mine', 'jira', 'archived'] as const),
        statuses: new Set(['testing', 'todo'] as const),
        product: 'dc',
        query: '  IS-12 '
      })
    ).toEqual({
      ...EMPTY_BUILD_WEB_SAVED_FILTER,
      q: 'IS-12',
      product: ['dc'],
      status: ['todo', 'testing'],
      jira: ['yes'],
      mine: true
    })
  })

  it('reads back what it saved, with nothing left over', () => {
    const view = {
      quick: new Set(['ai', 'favorite'] as const),
      statuses: new Set(['inprogress'] as const),
      product: 'all' as const,
      query: 'deploy'
    }
    expect(viewOfSavedFilter(savedFilterOfView(view))).toEqual({
      quick: ['ai', 'favorite'],
      statuses: ['inprogress'],
      product: 'all',
      query: 'deploy',
      unsupported: []
    })
  })

  it('names what the console narrows by and Orca does not', () => {
    const applied = viewOfSavedFilter({
      ...EMPTY_BUILD_WEB_SAVED_FILTER,
      product: ['dc', 'sa'],
      type: ['bug'],
      jira: ['no'],
      from: '2026-09-01',
      rootOnly: true,
      status: ['testing', 'nonsense']
    })
    expect(applied.product).toBe('all')
    expect(applied.statuses).toEqual(['testing'])
    expect(applied.quick).toEqual([])
    expect(applied.unsupported).toEqual(['type', 'product', 'jira', 'dates', 'rootOnly'])
  })
})

describe('where the console files a saved query', () => {
  it('under its own product, else under a fixed one', () => {
    expect(storageProductOf({ ...EMPTY_BUILD_WEB_SAVED_FILTER, product: ['sa'] })).toBe('sa')
    expect(storageProductOf(EMPTY_BUILD_WEB_SAVED_FILTER)).toBe('dc')
    expect(storageProductOf({ ...EMPTY_BUILD_WEB_SAVED_FILTER, product: ['sa', 'ap'] })).toBe('dc')
  })
})
