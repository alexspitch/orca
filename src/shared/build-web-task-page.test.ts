import { describe, expect, it } from 'vitest'
import { hasTaskFilters, NO_TASK_FILTERS, taskPageArgs } from './build-web-task-page'

describe('the page of all tasks (IS-10)', () => {
  it('asks for a page by offset and sends only the filters set', () => {
    expect(taskPageArgs(NO_TASK_FILTERS, 2, 25)).toEqual({ offset: 50, limit: 25 })
    const narrowed = {
      ...NO_TASK_FILTERS,
      kinds: ['redos'],
      states: ['failed' as const],
      q: ' IS-10 '
    }
    expect(taskPageArgs(narrowed, 0, 50)).toEqual({
      offset: 0,
      limit: 50,
      kinds: ['redos'],
      states: ['failed'],
      q: 'IS-10'
    })
  })

  it('tells a narrowed list from the whole one', () => {
    expect(hasTaskFilters(NO_TASK_FILTERS)).toBe(false)
    expect(hasTaskFilters({ ...NO_TASK_FILTERS, q: '  ' })).toBe(false)
    expect(hasTaskFilters({ ...NO_TASK_FILTERS, user: 'qa@box.test' })).toBe(true)
  })
})
