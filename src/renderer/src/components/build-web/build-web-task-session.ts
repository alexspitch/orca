import { activateTabAndFocusPane } from '@/lib/activate-tab-and-focus-pane'
import { activateStructuredAgentSessionTab } from '@/lib/structured-agent-session-tab-activation'
import { activateAndRevealWorktree } from '@/lib/worktree-activation'
import { useAppStore } from '@/store'
import type { Tab } from '../../../../shared/tab-types'
import type { TerminalTab } from '../../../../shared/terminal-tab-types'

// «Take to work» names its session after the tasks, so taking them again opens that session.

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

/** The names a session of these tasks may carry: today's, then the keys-only one of before. */
export function taskSessionNames(issues: readonly TaskNameSource[]): string[] {
  return [taskSessionName(issues), taskKeysLabel(issues.map((i) => i.key))]
}

export type NamedTaskSession = {
  kind: 'terminal' | 'structured'
  worktreeId: string
  tabId: string
}

type SessionTabsState = {
  activeWorktreeId: string | null
  tabsByWorktree: Record<string, TerminalTab[] | undefined>
  unifiedTabsByWorktree: Record<string, Tab[] | undefined>
}

/** An open tab whose own name (a rename or the launch label) is one of `names`; the active worktree's first. */
export function findNamedTaskSession(
  state: SessionTabsState,
  names: readonly string[]
): NamedTaskSession | null {
  const wanted = new Set(names.map((n) => n.trim().toLowerCase()).filter(Boolean))
  if (wanted.size === 0) {
    return null
  }
  const sameName = (title: string | null | undefined): boolean =>
    wanted.has(title?.trim().toLowerCase() ?? '')
  const worktreeIds = [
    ...new Set([
      ...(state.activeWorktreeId ? [state.activeWorktreeId] : []),
      ...Object.keys(state.tabsByWorktree),
      ...Object.keys(state.unifiedTabsByWorktree)
    ])
  ]
  for (const worktreeId of worktreeIds) {
    const terminal = (state.tabsByWorktree[worktreeId] ?? []).find(
      (tab) => sameName(tab.customTitle) || sameName(tab.quickCommandLabel)
    )
    if (terminal) {
      return { kind: 'terminal', worktreeId, tabId: terminal.id }
    }
    const structured = (state.unifiedTabsByWorktree[worktreeId] ?? []).find(
      (tab) => tab.contentType === 'agent-session' && sameName(tab.customLabel)
    )
    if (structured) {
      return { kind: 'structured', worktreeId, tabId: structured.id }
    }
  }
  return null
}

/** Reveal the session named after these tasks if one is open; false when there is none. */
export function openNamedTaskSession(issues: readonly TaskNameSource[]): boolean {
  const state = useAppStore.getState()
  const found = findNamedTaskSession(state, taskSessionNames(issues))
  if (!found) {
    return false
  }
  const hostId = state.getKnownWorktreeById(found.worktreeId)?.hostId
  if (
    activateAndRevealWorktree(
      found.worktreeId,
      hostId ? { executionHostId: hostId } : undefined
    ) === false
  ) {
    return false
  }
  if (found.kind === 'terminal') {
    activateTabAndFocusPane(found.tabId, null)
    return true
  }
  return activateStructuredAgentSessionTab({ worktreeId: found.worktreeId, tabId: found.tabId })
}
