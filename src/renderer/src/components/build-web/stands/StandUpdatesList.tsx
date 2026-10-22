import { translate } from '@/i18n/i18n'
import type { BuildWebStandUpdate } from '../../../../../shared/build-web-stand-types'

function updateLine(update: BuildWebStandUpdate): string {
  if (update.newer) {
    return `${update.running ?? '?'} → ${update.newer}`
  }
  return translate('buildWeb.stands.health.notApplied', 'not recreated since its image changed')
}

/** The running services to update, one line each, for a tooltip. */
export function StandUpdatesList({
  title,
  updates
}: {
  /** The stands the services belong to, in a list that spans stands. */
  title?: string
  updates: BuildWebStandUpdate[]
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-0.5">
      {title ? <span className="font-medium">{title}</span> : null}
      {updates.map((update) => (
        <span key={update.service} className="flex gap-2">
          <span className="font-mono">{update.service}</span>
          <span className="font-mono opacity-80">{updateLine(update)}</span>
        </span>
      ))}
    </div>
  )
}
