import { describe, expect, it } from 'vitest'
import type { BuildWebRecap } from '../../../../../shared/build-web-recap-types'
import {
  calendarWeeks,
  dayKey,
  monthRangeIso,
  recapsByDay,
  sameMonth,
  shiftMonth
} from './recap-calendar'

const recap = (id: string, finishedAt: Date): BuildWebRecap => ({
  id,
  automation_id: 'a',
  name: id,
  product: 'dc',
  version: null,
  commit: null,
  trigger: 'scheduled',
  started_by: null,
  finished_at: finishedAt.toISOString()
})

describe('the Recaps calendar', () => {
  it('steps months across the year', () => {
    expect(shiftMonth({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 })
    expect(shiftMonth({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 })
    expect(sameMonth({ year: 2026, month: 9 }, { year: 2026, month: 9 })).toBe(true)
  })

  it('asks for the month from its first local midnight to the next month’s', () => {
    const range = monthRangeIso({ year: 2026, month: 9 })
    expect(new Date(range.from).getTime()).toBe(new Date(2026, 9, 1).getTime())
    expect(new Date(range.to).getTime()).toBe(new Date(2026, 10, 1).getTime())
  })

  it('lays the month out as whole weeks from the locale’s first day', () => {
    // October 2026 starts on a Thursday and has 31 days.
    const monday = calendarWeeks({ year: 2026, month: 9 }, 1)
    expect(monday).toHaveLength(5)
    expect(dayKey(monday[0][0])).toBe('2026-09-28')
    expect(dayKey(monday[0][3])).toBe('2026-10-01')
    expect(dayKey(monday[4][6])).toBe('2026-11-01')
    const sunday = calendarWeeks({ year: 2026, month: 9 }, 0)
    expect(dayKey(sunday[0][0])).toBe('2026-09-27')
    expect(sunday.every((week) => week.length === 7)).toBe(true)
  })

  it('puts each report on the local day it finished, in the order they finished', () => {
    const byDay = recapsByDay([
      recap('late', new Date(2026, 9, 19, 23, 30)),
      recap('early', new Date(2026, 9, 19, 6, 0)),
      recap('next', new Date(2026, 9, 20, 0, 5))
    ])
    expect(byDay.get('2026-10-19')?.map((r) => r.id)).toEqual(['early', 'late'])
    expect(byDay.get('2026-10-20')?.map((r) => r.id)).toEqual(['next'])
  })
})
