import { describe, expect, it } from 'vitest'
import { familiesOf, foldedOf, headCount, isUnder, visibleIssues } from './build-web-families'

// A page as build-web answers with the tree: task 1 with two subtasks, task 4 alone, and a subtask
// whose task the filters left out.
const page = [
  { id: '1', parent_id: null },
  { id: '2', parent_id: '1' },
  { id: '3', parent_id: '1' },
  { id: '4', parent_id: null },
  { id: '5', parent_id: 'gone' }
]

describe('issue families', () => {
  it('counts each task’s subtasks on the page; a subtask without its task is a head', () => {
    const kids = familiesOf(page)
    expect([...kids]).toEqual([['1', 2]])
    expect(isUnder(page[1], kids)).toBe(true)
    expect(isUnder(page[4], kids)).toBe(false)
    expect(headCount(page, kids)).toBe(3)
  })

  it('hides the subtasks of a folded task, and folds every family less the ones opened by hand', () => {
    const kids = familiesOf(page)
    expect(visibleIssues(page, kids, foldedOf(false, ['1'], kids)).map((i) => i.id)).toEqual([
      '1',
      '4',
      '5'
    ])
    expect(foldedOf(true, [], kids)).toEqual(new Set(['1']))
    expect(foldedOf(true, ['1'], kids)).toEqual(new Set())
    expect(visibleIssues(page, kids, new Set()).length).toBe(5)
  })
})
