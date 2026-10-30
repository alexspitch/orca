import { describe, expect, it } from 'vitest'
import { BUILD_WEB_OPEN_STATUSES } from '../../../../shared/build-web-types'
import { blockerFilterNames } from './sidebar-blocker-filters'

describe('blockerFilterNames', () => {
  it('names nothing when the Issues filters leave every open task', () => {
    expect(
      blockerFilterNames({
        quick: new Set(),
        statuses: new Set([...BUILD_WEB_OPEN_STATUSES, 'done']),
        products: new Set(),
        assignees: new Set(),
        me: 'me@spitch.ch',
        query: ' '
      })
    ).toEqual([])
  })

  it('names the quick filters, products, assignees, the open statuses chosen and the search', () => {
    expect(
      blockerFilterNames({
        quick: new Set(['jira', 'mine']),
        statuses: new Set(['todo', 'inprogress', 'done']),
        products: new Set(['dc', 'sa']),
        assignees: new Set(['me@spitch.ch', 'none', 'oleg@spitch.ch']),
        me: 'Me@Spitch.ch',
        query: 'IS-1'
      })
    ).toEqual(['Mine', 'Jira', 'SA, DC', 'Mine, Unassigned, oleg', 'To do, In progress', '«IS-1»'])
  })
})
