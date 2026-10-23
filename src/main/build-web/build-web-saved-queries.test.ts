import { describe, expect, it } from 'vitest'
import { EMPTY_BUILD_WEB_SAVED_FILTER } from '../../shared/build-web-saved-query-types'
import { savedFilterOf } from './build-web-saved-queries'

describe('a saved filter read from build-web', () => {
  it('keeps the fields of the right shape and empties the rest', () => {
    expect(
      savedFilterOf({
        q: 'x',
        status: ['todo', 7, ''],
        mine: true,
        ai: 'yes',
        from: 3,
        gone: ['old field']
      })
    ).toEqual({ ...EMPTY_BUILD_WEB_SAVED_FILTER, q: 'x', status: ['todo', '7'], mine: true })
    expect(savedFilterOf(null)).toEqual(EMPTY_BUILD_WEB_SAVED_FILTER)
  })
})
