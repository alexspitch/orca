import { useState } from 'react'
import { Loader2, RotateCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Toggle } from '@/components/ui/toggle'
import { translate } from '@/i18n/i18n'
import {
  BUILD_WEB_STAND_LOG_TAILS,
  type BuildWebStandLogTail
} from '../../../../../shared/build-web-stand-types'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import { LogViewer } from '../log-viewer/LogViewer'
import { readStandViewPrefs, writeStandViewPrefs } from './stand-view-prefs'
import { useStandLog } from './use-stand-log'

/** One service's log: the last lines asked for, and, followed, every line it writes after them. */
export function StandLogPanel({
  target,
  standId,
  service,
  onClose
}: {
  target: RuntimeClientTarget
  standId: string
  service: string
  onClose: () => void
}): React.JSX.Element {
  const [tail, setTail] = useState<BuildWebStandLogTail>(() => readStandViewPrefs().logTail)
  const [follow, setFollow] = useState(true)
  const [attempt, setAttempt] = useState(0)
  const { log, done, trimmed, error, routeMissing } = useStandLog(
    target,
    { standId, service, tail, follow },
    attempt
  )

  const status = error
    ? null
    : done
      ? follow
        ? translate('buildWeb.stands.log.ended', 'The stream ended.')
        : translate('buildWeb.stands.log.loaded', 'The last lines, as of now.')
      : follow
        ? translate('buildWeb.stands.log.following', 'Following the log…')
        : translate('buildWeb.stands.log.loading', 'Reading the log…')

  const toolbar = (
    <>
      <span className="truncate font-mono text-xs font-medium text-foreground">{service}</span>
      <Select
        value={String(tail)}
        onValueChange={(value) => {
          const next = BUILD_WEB_STAND_LOG_TAILS.find((n) => String(n) === value) ?? tail
          writeStandViewPrefs({ logTail: next })
          setTail(next)
        }}
      >
        <SelectTrigger size="sm" aria-label={translate('buildWeb.stands.log.tail', 'Lines')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {BUILD_WEB_STAND_LOG_TAILS.map((n) => (
            <SelectItem key={n} value={String(n)}>
              {translate('buildWeb.stands.log.lastLines', 'Last {{lines}} lines', {
                lines: n.toLocaleString()
              })}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Toggle variant="outline" size="sm" pressed={follow} onPressedChange={setFollow}>
        {translate('buildWeb.stands.log.follow', 'Follow (tail -f)')}
      </Toggle>
      <span className="flex min-w-0 items-center gap-1.5 truncate">
        {!done && !error ? <Loader2 className="size-3 shrink-0 animate-spin" /> : null}
        {status}
        {trimmed ? (
          <span>{translate('buildWeb.stands.log.trimmed', 'Earlier lines are not shown.')}</span>
        ) : null}
      </span>
      {done ? (
        <Button variant="ghost" size="xs" onClick={() => setAttempt((n) => n + 1)}>
          <RotateCw />
          {translate('buildWeb.stands.log.reconnect', 'Read again')}
        </Button>
      ) : null}
    </>
  )

  return (
    <section className="flex h-full min-h-0 flex-col gap-2 p-3">
      <LogViewer
        log={log}
        toolbar={toolbar}
        trailing={
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={translate('buildWeb.stands.log.close', 'Close the log')}
            onClick={onClose}
          >
            <X />
          </Button>
        }
        emptyLabel={
          done && !error
            ? translate('buildWeb.stands.log.empty', 'The service has written nothing.')
            : ''
        }
      />
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {routeMissing
            ? translate(
                'buildWeb.stands.log.updateConsole',
                'This build-web cannot read service logs yet. Update build-web.'
              )
            : error}
        </p>
      ) : null}
    </section>
  )
}
