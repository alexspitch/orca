import { useCallback, useEffect, useState } from 'react'
import { translate } from '@/i18n/i18n'
import type { BuildWebIssueDetail, BuildWebIssueRow } from '../../../../shared/build-web-types'
import type { RuntimeClientTarget } from '../../../../shared/runtime-client-target'
import {
  createLiveReads,
  createLiveReplyGuard,
  sameReading
} from '../../../../shared/build-web-live-reads'
import { callBuildWeb } from './build-web-client'
import { StatusPicker } from './BuildWebRowPickers'
import { useBuildWebTarget } from './use-build-web-data'
import { useIssueRowPatch } from './use-build-web-issue-write'
import { useLiveRead } from './use-live-read'

const childReads = createLiveReads<BuildWebIssueRow[]>()

/** What stops the task while subtasks are open; empty when none are. */
export function blockedBySubtasks(issue: Pick<BuildWebIssueRow, 'children_open'>): string {
  if (issue.children_open <= 0) {
    return ''
  }
  return translate(
    'buildWeb.subtasks.blocked',
    'Open subtasks: {{count}} — the task will not close or go out to deploy.',
    { count: issue.children_open }
  )
}

/**
 * A task's subtasks, as build-web's card lists them: number, title and status, moved right here.
 * A click on the number opens the subtask; a move reads the task again, since it may hold it.
 * Read again every few seconds while `visible`: a subtask moved elsewhere holds no parent here.
 */
export function BuildWebIssueSubtasks({
  target,
  detail,
  visible,
  onOpen,
  onChanged
}: {
  target: RuntimeClientTarget
  detail: BuildWebIssueDetail
  visible: boolean
  onOpen: (id: string) => void
  onChanged: () => void
}): React.JSX.Element {
  const { contextKey } = useBuildWebTarget()
  const [children, setChildren] = useState<BuildWebIssueRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [guard] = useState(createLiveReplyGuard)
  const { busy, patch } = useIssueRowPatch()
  const load = useCallback(async () => {
    guard.mark()
    try {
      setChildren(await callBuildWeb(target, 'listIssueChildren', { id: detail.id }))
      setError(null)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure))
    }
  }, [detail.id, guard, target])
  useEffect(() => {
    void load()
  }, [load])
  useLiveRead(
    childReads,
    `${contextKey}|${detail.id}`,
    visible,
    () => callBuildWeb(target, 'listIssueChildren', { id: detail.id }),
    (next, issuedAt) => {
      if (guard.accepts(issuedAt)) {
        setChildren((shown) => (shown && sameReading(shown, next) ? shown : next))
        setError(null)
      }
    }
  )

  const blocked = blockedBySubtasks(detail)
  return (
    <div className="flex flex-col gap-2">
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
      {children?.map((child) => (
        <div key={child.id} className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => onOpen(child.id)}
            className="shrink-0 font-mono text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            {child.key}
          </button>
          <span className="min-w-0 flex-1 truncate text-sm" title={child.title}>
            {child.title}
          </span>
          <StatusPicker
            issue={child}
            busy={busy.has(child.id)}
            onPatch={(change) =>
              void patch(child, change).then(() => {
                void load()
                onChanged()
              })
            }
          />
        </div>
      ))}
      {children?.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {translate(
            'buildWeb.subtasks.none',
            'No subtasks. A problem found while checking the task is filed under it in build-web.'
          )}
        </p>
      ) : null}
      {blocked ? <p className="text-xs text-chip-tone-amber">{blocked}</p> : null}
    </div>
  )
}
