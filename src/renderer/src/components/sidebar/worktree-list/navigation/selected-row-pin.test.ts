import { describe, expect, it } from 'vitest'
import { pinnedRowScrollTop, type PinnedRowGeometry } from './selected-row-pin'

// A compact list: the previous selection closed above the new one, which opened to 60 px.
const base: PinnedRowGeometry = {
  scrollTop: 400,
  rowTop: 128,
  rowHeight: 60,
  pinnedTop: 160,
  viewportHeight: 600,
  topInset: 34,
  maxScrollTop: 2000
}

describe('pinnedRowScrollTop', () => {
  it('scrolls back by what closed above, so the selected row stays where it was chosen', () => {
    expect(pinnedRowScrollTop(base)).toBe(368)
  })

  it('leaves the scroll alone when nothing above it moved', () => {
    expect(pinnedRowScrollTop({ ...base, rowTop: 160 })).toBe(400)
  })

  it('stops at the top of the list', () => {
    expect(pinnedRowScrollTop({ ...base, scrollTop: 10 })).toBe(0)
  })

  it('shows the bottom of a row that opened past the viewport', () => {
    // Chosen at the bottom edge: compact 28 px at 572, now 90 px tall.
    expect(pinnedRowScrollTop({ ...base, rowTop: 572, rowHeight: 90, pinnedTop: 572 })).toBe(462)
  })

  it('keeps the title below the sticky header when the row outgrows the viewport', () => {
    expect(pinnedRowScrollTop({ ...base, rowTop: 200, rowHeight: 900, pinnedTop: 200 })).toBe(
      400 + 200 - 34
    )
  })
})
