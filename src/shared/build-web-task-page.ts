import type { BuildWebTaskPageArgs, BuildWebTaskState } from './build-web-activity-types'

// IS-10: the filters of the console's /tasks as Orca keeps them, desktop and phone alike.

export type BuildWebTaskFilters = {
  kinds: string[]
  states: BuildWebTaskState[]
  /** An author, or empty for everybody. */
  user: string
  from: string
  to: string
  q: string
}

export const NO_TASK_FILTERS: BuildWebTaskFilters = {
  kinds: [],
  states: [],
  user: '',
  from: '',
  to: '',
  q: ''
}

export const hasTaskFilters = (f: BuildWebTaskFilters): boolean =>
  f.kinds.length > 0 || f.states.length > 0 || Boolean(f.user || f.from || f.to || f.q.trim())

/** The request for page `page` (from 0) of `perPage`; a filter left empty is not sent. */
export function taskPageArgs(
  f: BuildWebTaskFilters,
  page: number,
  perPage: number
): BuildWebTaskPageArgs {
  const q = f.q.trim()
  return {
    offset: page * perPage,
    limit: perPage,
    ...(f.kinds.length ? { kinds: f.kinds } : {}),
    ...(f.states.length ? { states: f.states } : {}),
    ...(f.user ? { user: f.user } : {}),
    ...(f.from ? { from: f.from } : {}),
    ...(f.to ? { to: f.to } : {}),
    ...(q ? { q } : {})
  }
}
