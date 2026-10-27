import { useCallback } from 'react'
import type { BuildWebIssueRow } from '../../../../src/shared/build-web-types'
import { BUILD_WEB_CARD_TABS, type BuildWebCardTab } from '../build-web-card-tabs'
import { recordOf, useStoredHostTabs } from './use-stored-host-tabs'

// The desktop's task tabs (build-web-task-tabs) as a strip of recent tasks: each opened card is
// kept, newest first, so a phone gets back to it in one tap.

export type BuildWebTaskTab = {
  id: string
  key: string | null
  title: string | null
  cardTab: BuildWebCardTab
}

// Why a cap: tabs survive restarts, so one per task ever opened would grow without end.
const TABS_KEPT = 30

const text = (value: unknown): string | null => (typeof value === 'string' && value ? value : null)

function tabsOf(raw: unknown): BuildWebTaskTab[] {
  if (!Array.isArray(raw)) {
    return []
  }
  return raw.flatMap((entry: unknown) => {
    const v = recordOf(entry)
    const id = text(v.id)
    return id
      ? [
          {
            id,
            key: text(v.key),
            title: text(v.title),
            cardTab: BUILD_WEB_CARD_TABS.find((tab) => tab === v.cardTab) ?? 'overview'
          }
        ]
      : []
  })
}

/** Per build-web console: another console's task ids mean nothing here. */
export function useRecentTasks(hostId: string, consoleUrl: string) {
  const [tabs, update] = useStoredHostTabs(`orca:buildWebTaskTabs:${hostId}`, consoleUrl, tabsOf)

  /** The task moves to the front; a row names it before its card has loaded. */
  const keep = useCallback(
    (id: string, row: Pick<BuildWebIssueRow, 'key' | 'title'> | null) =>
      update((current) => {
        const known = current.find((tab) => tab.id === id)
        const entry: BuildWebTaskTab = {
          id,
          key: row?.key ?? known?.key ?? null,
          title: row?.title ?? known?.title ?? null,
          cardTab: known?.cardTab ?? 'overview'
        }
        return [entry, ...current.filter((tab) => tab.id !== id)].slice(0, TABS_KEPT)
      }),
    [update]
  )

  const close = useCallback(
    (id: string) => update((current) => current.filter((tab) => tab.id !== id)),
    [update]
  )

  const clear = useCallback(() => update(() => []), [update])

  return { tabs, keep, close, clear }
}

export type RecentTasks = ReturnType<typeof useRecentTasks>
