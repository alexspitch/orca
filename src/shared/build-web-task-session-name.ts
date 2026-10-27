// «Take to work» names its session after the tasks, on the desktop and the phone alike.

const NAME_MAX = 80
const NAMED_TASKS = 3
// Why: these mean something to a shell or to Windows' tokenizer even inside double quotes.
const UNSAFE_IN_ARGS = /[\\$`%!^]/g

export type TaskNameSource = { key: string; title: string }

/** The keys alone, as sessions were named before titles: still matched, so those reopen too. */
export function taskKeysLabel(keys: string[]): string {
  const unique = [...new Set(keys)]
  const named = unique.slice(0, NAMED_TASKS).join(', ')
  return unique.length > NAMED_TASKS ? `${named} +${unique.length - NAMED_TASKS}` : named
}

const cut = (text: string, max: number): string =>
  text.length <= max ? text : max <= 1 ? '' : `${text.slice(0, max - 1).trimEnd()}…`

/** Titles cut so they share `room` characters; a short one leaves its rest to the others. */
function fitTitles(titles: string[], room: number): string[] {
  const out = [...titles]
  const shortestFirst = titles.map((_, i) => i).sort((a, b) => titles[a].length - titles[b].length)
  let left = room
  shortestFirst.forEach((i, at) => {
    out[i] = cut(titles[i], Math.floor(left / (shortestFirst.length - at)))
    left -= out[i].length
  })
  return out
}

/** `KEY Title`; a batch's first three joined by `; ` and `+N`, titles cut to fit 80 characters. */
export function taskSessionName(issues: readonly TaskNameSource[]): string {
  const unique = [...new Map(issues.map((i) => [i.key, i])).values()]
  const shown = unique.slice(0, NAMED_TASKS)
  const more = unique.length - shown.length
  const suffix = more > 0 ? ` +${more}` : ''
  // Keys are never cut: each takes its length, a space before its title, and `; ` between parts.
  const fixed =
    shown.reduce((n, i) => n + i.key.length + 1, 0) + (shown.length - 1) * 2 + suffix.length
  const titles = fitTitles(
    shown.map((i) => i.title.replace(/\s+/g, ' ').trim()),
    Math.max(0, NAME_MAX - fixed)
  )
  return `${shown.map((i, at) => (titles[at] ? `${i.key} ${titles[at]}` : i.key)).join('; ')}${suffix}`
}

/** The user's own Claude arguments plus `--name`, quoted so every startup shell reads one value. */
export function claudeNameArgs(defaultArgs: string, name: string): string {
  const safe = name
    .replace(/'/g, '’')
    .replace(/"/g, '”')
    .replace(UNSAFE_IN_ARGS, '')
    .replace(/[\p{Cc}\s]+/gu, ' ')
    .trim()
  return [defaultArgs.trim(), safe ? `--name "${safe}"` : ''].filter(Boolean).join(' ')
}
