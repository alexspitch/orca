import React from 'react'
import { ChevronRight, Play, RotateCw, Square } from 'lucide-react'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import type {
  DevServicesProfile,
  DevServicesService
} from '../../../../shared/dev-services-contract'
import { DevServiceRow } from './DevServiceRow'
import { DevServiceIconAction } from './DevServiceIconAction'
import { devServicesActionKey, type DevServicesActions } from './use-dev-services-actions'

function ProfileActions({
  profile,
  actions
}: {
  profile: DevServicesProfile
  actions: DevServicesActions
}): React.JSX.Element {
  const title = profile.title ?? profile.id
  const busy = (verb: string): boolean =>
    actions.pending.has(devServicesActionKey(verb, [profile.id]))
  const run = (verb: 'start' | 'restart' | 'stop', label: string): void =>
    actions.run({ verb, args: [profile.id], label })
  const startLabel =
    profile.includes.length > 0
      ? translate(
          'devServices.profile.startWithIncludes',
          'Start {{value0}} with {{value1}}; running services are skipped',
          { value0: title, value1: profile.includes.join(', ') }
        )
      : translate('devServices.profile.start', 'Start {{value0}}', { value0: title })
  const restartLabel = translate('devServices.profile.restart', 'Restart running {{value0}}', {
    value0: title
  })
  const stopLabel = translate('devServices.profile.stop', 'Stop {{value0}}', { value0: title })
  return (
    <>
      {profile.running < profile.total && (
        <DevServiceIconAction
          label={startLabel}
          icon={<Play />}
          busy={busy('start')}
          onClick={() => run('start', startLabel)}
        />
      )}
      {profile.running > 0 && (
        <>
          <DevServiceIconAction
            label={restartLabel}
            icon={<RotateCw />}
            busy={busy('restart')}
            onClick={() => run('restart', restartLabel)}
          />
          <DevServiceIconAction
            label={stopLabel}
            icon={<Square />}
            busy={busy('stop')}
            onClick={() => run('stop', stopLabel)}
          />
        </>
      )}
    </>
  )
}

export function DevServicesSection({
  id,
  title,
  count,
  collapsed,
  onToggle,
  profile,
  services,
  actions
}: {
  id: string
  title: string
  count?: string
  collapsed: boolean
  onToggle: () => void
  /** Present for a profile section: its header carries start / restart / stop. */
  profile?: DevServicesProfile
  services: DevServicesService[]
  actions: DevServicesActions
}): React.JSX.Element {
  const bodyId = `dev-services-section-${id}`
  return (
    <div className="px-3 pt-2">
      <div className="sticky top-0 z-10 mb-1 flex items-center gap-0.5 border-b border-border/40 bg-background py-0.5">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1 py-0.5 text-left text-muted-foreground transition-colors hover:text-foreground"
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-controls={bodyId}
        >
          <ChevronRight
            size={12}
            className={cn('shrink-0 transition-transform', !collapsed && 'rotate-90')}
          />
          <span className="truncate text-3xs font-semibold uppercase tracking-wider">{title}</span>
          {count && (
            <span className="ml-1 shrink-0 text-3xs tabular-nums text-muted-foreground/60">
              {count}
            </span>
          )}
        </button>
        {profile && <ProfileActions profile={profile} actions={actions} />}
      </div>
      {!collapsed && (
        <div id={bodyId}>
          {services.map((service) => (
            <DevServiceRow key={service.id} service={service} actions={actions} />
          ))}
        </div>
      )}
    </div>
  )
}
