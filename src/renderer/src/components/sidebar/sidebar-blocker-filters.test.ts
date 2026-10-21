import { describe, expect, it } from 'vitest'
import { BUILD_WEB_OPEN_STATUSES } from '../../../../shared/build-web-types'
import { blockerFilterNames } from './sidebar-blocker-filters'

describe('blockerFilterNames', () => {
  it('names nothing when the Issues filters leave every open task', () => {
    expect(
      blockerFilterNames({
        quick: new Set(),
        statuses: new Set([...BUILD_WEB_OPEN_STATUSES, 'done']),
        product: 'all',
        query: ' '
      })
    ).toEqual([])
  })

  it('names the quick filters, the product, the open statuses chosen and the search', () => {
    expect(
      blockerFilterNames({
        quick: new Set(['jira', 'mine']),
        statuses: new Set(['todo', 'inprogress', 'done']),
        product: 'dc',
        query: 'IS-1'
      })
    ).toEqual(['Mine', 'Jira', 'DC', 'To do, In progress', '«IS-1»'])
  })
})
