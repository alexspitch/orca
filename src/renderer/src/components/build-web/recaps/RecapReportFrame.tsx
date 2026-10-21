import { useEffect, useMemo, useRef } from 'react'
import { useDocumentDarkTheme } from '@/hooks/use-document-dark-theme'
import { BUILD_WEB_REPORT_FRAME_NAME_PREFIX } from '../../../../../shared/build-web-recap-types'
import { typeTone } from '../build-web-tones'
import { recapReportDocument } from './recap-report-document'
import {
  RECAP_TASK_MESSAGE,
  isRecapTaskKey,
  linkRecapTasks,
  type RecapTaskTones
} from './recap-task-links'

/** Orca's chip colours as the theme resolves them now: the frame cannot read Orca's variables. */
function taskTones(): RecapTaskTones {
  const root = getComputedStyle(document.documentElement)
  const tone = (name: string) => root.getPropertyValue(`--chip-tone-${name}`).trim()
  return {
    link: tone('blue'),
    bug: tone(typeTone('bug')),
    improvement: tone(typeTone('improvement')),
    chore: tone(typeTone('chore'))
  }
}

/**
 * One automation report, as build-web renders it, in an opaque-origin frame that may run its own
 * charts and nothing else. The host lets the frame load this one document and never navigate.
 */
export function RecapReportFrame({
  runId,
  title,
  html,
  onOpenTask
}: {
  runId: string
  title: string
  html: string
  /** A task number clicked in the report. */
  onOpenTask: (key: string) => void
}): React.JSX.Element {
  const colorScheme = useDocumentDarkTheme() ? 'dark' : 'light'
  // Why read each render: the theme decides the colours, and it re-renders this frame when it changes.
  const { bug, improvement, chore, link } = taskTones()
  const srcDoc = useMemo(
    () => recapReportDocument(linkRecapTasks(html, { bug, improvement, chore, link })),
    [html, bug, improvement, chore, link]
  )
  const frameRef = useRef<HTMLIFrameElement>(null)
  const openTask = useRef(onOpenTask)
  openTask.current = onOpenTask
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      // Why the source check: any frame may post; only this report's numbers open a task.
      const data: unknown = event.data
      if (
        event.source === frameRef.current?.contentWindow &&
        typeof data === 'object' &&
        data !== null &&
        'type' in data &&
        data.type === RECAP_TASK_MESSAGE &&
        'key' in data &&
        typeof data.key === 'string' &&
        isRecapTaskKey(data.key)
      ) {
        openTask.current(data.key)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])
  return (
    <iframe
      ref={frameRef}
      // Why the key: a srcDoc swapped in place is a navigation the host refuses, and mermaid reads
      // the theme once — a new report or theme is a new frame.
      key={`${runId}:${colorScheme}`}
      name={`${BUILD_WEB_REPORT_FRAME_NAME_PREFIX}${runId}`}
      title={title}
      // SECURITY: never add allow-same-origin; the report is agent-written HTML.
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      srcDoc={srcDoc}
      className="block min-h-0 w-full flex-1 border-0"
      // Why: a color-scheme mismatch with the frame document paints an opaque canvas.
      style={{ colorScheme }}
    />
  )
}
