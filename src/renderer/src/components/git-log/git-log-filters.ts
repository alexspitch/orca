import type { GitLogQuery } from '../../../../shared/git-log-page-types'

export type GitLogFilters = {
  text: string
  regex: boolean
  matchCase: boolean
  /** A ref's full name (`refs/heads/main`), `HEAD`, or null for every branch. */
  branch: string | null
  author: string | null
  sinceDays: number | null
}

export const EMPTY_GIT_LOG_FILTERS: GitLogFilters = {
  text: '',
  regex: false,
  matchCase: false,
  branch: null,
  author: null,
  sinceDays: null
}

export function gitLogQueryOf(filters: GitLogFilters, limit: number, skip: number): GitLogQuery {
  const text = filters.text.trim()
  return {
    scope: filters.branch ? { kind: 'refs', refs: [filters.branch] } : { kind: 'all' },
    limit,
    ...(skip > 0 ? { skip } : {}),
    ...(text ? { text, regex: filters.regex, matchCase: filters.matchCase } : {}),
    ...(filters.author ? { author: filters.author } : {}),
    ...(filters.sinceDays ? { sinceDays: filters.sinceDays } : {})
  }
}

// Why: these filters drop commits between parent and child, so graph edges would point at the wrong rows.
export function gitLogFiltersBreakGraph(filters: GitLogFilters): boolean {
  return Boolean(filters.text.trim() || filters.author || filters.sinceDays)
}
