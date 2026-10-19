import { useMemo } from 'react'
import { useDocumentDarkTheme } from '@/hooks/use-document-dark-theme'
import { BUILD_WEB_REPORT_FRAME_NAME_PREFIX } from '../../../../../shared/build-web-recap-types'
import { recapReportDocument } from './recap-report-document'

/**
 * One automation report, as build-web renders it, in an opaque-origin frame that may run its own
 * charts and nothing else. The host lets the frame load this one document and never navigate.
 */
export function RecapReportFrame({
  runId,
  title,
  html
}: {
  runId: string
  title: string
  html: string
}): React.JSX.Element {
  const colorScheme = useDocumentDarkTheme() ? 'dark' : 'light'
  const srcDoc = useMemo(() => recapReportDocument(html), [html])
  return (
    <iframe
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
