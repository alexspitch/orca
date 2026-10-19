import { useCallback, useEffect, useRef, useState } from 'react'
import type { BuildWebRecapPage } from '../../../../../shared/build-web-recap-types'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import { callBuildWeb } from '../build-web-client'
import { monthRangeIso, type RecapMonth } from './recap-calendar'
import { recapQuery, type RecapFilters } from './recap-filters'

// Why: build-web pages by 200; a month of nightly reports is a page or two, never more than this.
const PAGE = 200
const MAX_PAGES = 5

export type RecapMonthState = {
  data: BuildWebRecapPage | null
  /** More reports finished this month than were read. */
  capped: boolean
  error: string | null
  loading: boolean
  reload: () => void
}

/** Every report that finished in the month and matches the filters; their own dates are ignored. */
export function useRecapMonth(
  target: RuntimeClientTarget,
  filters: RecapFilters,
  month: RecapMonth
): RecapMonthState {
  const [data, setData] = useState<BuildWebRecapPage | null>(null)
  const [capped, setCapped] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  // Why: an answer for a month or filters since left must not land over the newer one.
  const latest = useRef(0)

  const load = useCallback(async () => {
    const mine = ++latest.current
    setLoading(true)
    try {
      const range = monthRangeIso(month)
      let page: BuildWebRecapPage | null = null
      for (let n = 0; n < MAX_PAGES; n++) {
        const result = await callBuildWeb(target, 'recaps', {
          ...recapQuery({ ...filters, from: '', to: '' }, n, PAGE),
          ...range
        })
        if (mine !== latest.current) {
          return
        }
        if (!result.ok) {
          setError(result.error)
          return
        }
        page = page
          ? { ...result.value, results: [...page.results, ...result.value.results] }
          : result.value
        if (page.results.length >= page.total || result.value.results.length < PAGE) {
          break
        }
      }
      setData(page)
      setCapped(page !== null && page.results.length < page.total)
      setError(null)
    } catch (failure) {
      if (mine === latest.current) {
        setError(failure instanceof Error ? failure.message : String(failure))
      }
    } finally {
      if (mine === latest.current) {
        setLoading(false)
      }
    }
  }, [filters, month, target])

  useEffect(() => {
    void load()
  }, [load])

  return { data, capped, error, loading, reload: () => void load() }
}
