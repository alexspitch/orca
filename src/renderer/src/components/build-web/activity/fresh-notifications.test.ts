import { describe, expect, it } from 'vitest'
import type { BuildWebNotification } from '../../../../../shared/build-web-activity-types'
import { freshNotifications } from './fresh-notifications'

const note = (id: string, unread = true, count = 1): BuildWebNotification => ({
  id,
  kind: 'build',
  severity: 'error',
  title: `row ${id}`,
  body: '',
  issue_id: null,
  issue_key: null,
  run_id: null,
  count,
  last_at: '2026-10-21T09:00:00Z',
  unread
})

describe('which bell rows are news', () => {
  it('takes the first reading as the baseline and announces nothing from it', () => {
    const { fresh, known } = freshNotifications(null, [note('a'), note('b')])
    expect(fresh).toEqual([])
    expect([...known].sort()).toEqual(['a', 'b'])
  })

  it('announces an unread row not read before, once', () => {
    const first = freshNotifications(new Set(['a']), [note('b'), note('a')])
    expect(first.fresh.map((n) => n.id)).toEqual(['b'])
    expect(freshNotifications(first.known, [note('b'), note('a')]).fresh).toEqual([])
  })

  it('never announces a repeat folded into a row, or a row already read elsewhere', () => {
    expect(freshNotifications(new Set(['a']), [note('a', true, 5)]).fresh).toEqual([])
    expect(freshNotifications(new Set(['a']), [note('c', false)]).fresh).toEqual([])
  })
})
