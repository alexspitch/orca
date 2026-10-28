import { FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { translate } from '@/i18n/i18n'
import type { BuildWebConsoleTask } from '../../../../../shared/build-web-activity-types'
import { BuildWebJobPanel } from '../BuildWebJobPanel'
import { BuildLogBody } from '../images/BuildLogDialog'
import type { ActivityHost } from './open-activity-target'

/** What a task row shows over Orca: a console job's log, or a redos build's own page (IS-10). */
export type TaskView =
  | { kind: 'job'; task: BuildWebConsoleTask }
  | { kind: 'build-page'; task: BuildWebConsoleTask; url: string }

export function TaskViewDialog({
  view,
  host,
  onClose
}: {
  view: TaskView | null
  host: ActivityHost
  onClose: () => void
}): React.JSX.Element {
  const task = view?.task
  return (
    <Dialog open={view !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={view?.kind === 'build-page' ? 'sm:max-w-[min(1100px,92vw)]' : 'sm:max-w-3xl'}
      >
        <DialogHeader>
          <DialogTitle>{task?.title}</DialogTitle>
          {task?.detail ? <DialogDescription>{task.detail}</DialogDescription> : null}
        </DialogHeader>
        {view?.kind === 'job' ? (
          <BuildWebJobPanel
            key={view.task.id}
            target={host.target}
            jobId={view.task.id}
            label={view.task.kind}
            onJob={() => {}}
            onDone={() => {}}
          />
        ) : view?.kind === 'build-page' ? (
          <BuildLogBody
            key={view.url}
            target={host.target}
            url={view.url}
            test={false}
            webUrl={view.url}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

/** A redos build's own page, shown in Orca; the row itself still opens the run's card. */
export function BuildPageButton({ onOpen }: { onOpen: () => void }): React.JSX.Element {
  const label = translate('buildWeb.activity.buildPage', 'Build page')
  // Why every pointer event: a menu item selects on pointer-up as well as on click.
  const keep = (event: React.SyntheticEvent) => event.stopPropagation()
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      aria-label={label}
      title={label}
      onPointerDown={keep}
      onPointerUp={keep}
      onClick={(event) => {
        keep(event)
        onOpen()
      }}
    >
      <FileText />
    </Button>
  )
}
