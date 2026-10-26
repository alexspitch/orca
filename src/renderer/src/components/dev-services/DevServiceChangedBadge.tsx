import { FileDiff } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import type { DevServicesService } from '../../../../shared/dev-services-contract'
import { formatDevServiceElapsed } from './dev-services-sections'

type Changed = NonNullable<DevServicesService['changed']>

const FILES_SHOWN = 5

/** The badge's tooltip: what changed under the running service, and what is not built yet. */
export function devServiceChangedSummary(changed: Changed, nowMs: number = Date.now()): string {
  const lines = [
    typeof changed.since === 'number'
      ? translate(
          'devServices.changed.headSince',
          'Code on disk is newer than the running service ({{value0}})',
          {
            value0: formatDevServiceElapsed(changed.since, nowMs)
          }
        )
      : translate('devServices.changed.head', 'Code on disk is newer than the running service')
  ]
  if (changed.workspaces.length) {
    lines.push(
      translate('devServices.changed.workspaces', 'Workspaces: {{value0}}', {
        value0: changed.workspaces.join(', ')
      })
    )
  }
  if (changed.unbuilt.length) {
    lines.push(
      translate('devServices.changed.unbuilt', 'Not built: {{value0}}', {
        value0: changed.unbuilt.join(', ')
      })
    )
  }
  if (changed.files.length) {
    const more = changed.files.length - FILES_SHOWN
    lines.push(
      translate('devServices.changed.files', 'Files: {{value0}}', {
        value0: changed.files.slice(0, FILES_SHOWN).join(', ')
      }) +
        (more > 0
          ? ` ${translate('devServices.changed.moreFiles', '+{{value0}} more', { value0: more })}`
          : '')
    )
  }
  return lines.join('\n')
}

/** Shown on a service whose code on disk is newer than what it runs: it needs a restart. */
export function DevServiceChangedBadge({ changed }: { changed: Changed }): React.JSX.Element {
  const summary = devServiceChangedSummary(changed)
  return (
    <span className="inline-flex shrink-0 self-center" title={summary}>
      <FileDiff
        className="size-3 text-status-warning"
        aria-label={translate('devServices.changed.label', 'Needs restart: code changed')}
      />
    </span>
  )
}
