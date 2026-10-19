import { translate } from '@/i18n/i18n'
import type { BuildWebRecap } from '../../../../../shared/build-web-recap-types'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import { BuildWebListState } from '../BuildWebListState'
import { RecapReportFrame } from './RecapReportFrame'
import { useRecapReport } from './use-recap-report'

/** One report, read whole and then shown in its frame. */
export function RecapReportPane({
  target,
  contextKey,
  recap
}: {
  target: RuntimeClientTarget
  contextKey: string
  recap: BuildWebRecap
}): React.JSX.Element | null {
  const { html, error, retry } = useRecapReport(target, contextKey, recap.id)
  if (error) {
    return <BuildWebListState kind="error" error={error} onRetry={retry} />
  }
  // Why mounted only whole: the host lets a report frame load one document, never a second.
  return html === null ? (
    <BuildWebListState
      kind="loading"
      loadingLabel={translate('buildWeb.recaps.loadingReport', 'Loading the report…')}
    />
  ) : (
    <RecapReportFrame runId={recap.id} title={recap.name} html={html} />
  )
}
