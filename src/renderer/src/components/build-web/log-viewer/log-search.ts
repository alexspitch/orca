import type { LogLines } from './log-lines'

// Find in a log that keeps growing: only the lines added since the last pass are scanned, and the
// matches of lines that rolled out of the window are dropped.

/** A match by absolute line number, so it survives lines dropped from the window's head. */
export type LogMatch = { line: number; start: number; end: number }

export type LogSearch = {
  query: string
  /** Matches in whole lines, oldest first. */
  settled: LogMatch[]
  /** Absolute number of the first whole line not scanned yet. */
  scannedTo: number
  /** Settled matches plus those in the unfinished line. */
  matches: LogMatch[]
  /** More matches exist than are kept. */
  capped: boolean
}

export const LOG_SEARCH_MAX_MATCHES = 5000

function matchesIn(text: string, needle: string, line: number, out: LogMatch[]): void {
  const hay = text.toLowerCase()
  let at = hay.indexOf(needle)
  while (at !== -1 && out.length < LOG_SEARCH_MAX_MATCHES) {
    out.push({ line, start: at, end: at + needle.length })
    at = hay.indexOf(needle, at + needle.length)
  }
}

/** Case-insensitive matches of `query`, carried forward from `previous` when it is the same query. */
export function advanceLogSearch(
  previous: LogSearch | null,
  log: LogLines,
  query: string
): LogSearch {
  const needle = query.toLowerCase()
  if (!needle) {
    return { query, settled: [], scannedTo: log.first, matches: [], capped: false }
  }
  const same = previous !== null && previous.query === query
  const settled = same ? previous.settled.filter((m) => m.line >= log.first) : []
  const from = same ? Math.max(previous.scannedTo, log.first) : log.first
  const end = log.first + log.lines.length
  for (let line = from; line < end && settled.length < LOG_SEARCH_MAX_MATCHES; line++) {
    matchesIn(log.lines[line - log.first], needle, line, settled)
  }
  const matches = settled.slice()
  if (log.partial) {
    matchesIn(log.partial, needle, end, matches)
  }
  return {
    query,
    settled,
    scannedTo: end,
    matches,
    capped: matches.length >= LOG_SEARCH_MAX_MATCHES
  }
}

/** The matches inside one visible row, for highlighting it. */
export function matchesOnLine(matches: readonly LogMatch[], line: number): LogMatch[] {
  let lo = 0
  let hi = matches.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (matches[mid].line < line) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }
  const out: LogMatch[] = []
  for (let i = lo; i < matches.length && matches[i].line === line; i++) {
    out.push(matches[i])
  }
  return out
}
