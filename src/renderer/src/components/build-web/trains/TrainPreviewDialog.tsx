import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type {
  BuildWebTrain,
  BuildWebTrainImage,
  BuildWebTrainPreview
} from '../../../../../shared/build-web-train-types'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import { callBuildWeb } from '../build-web-client'
import { BuildWebToneChip } from '../BuildWebToneChip'

function imageWhy(i: BuildWebTrainImage): string {
  if (i.current && i.publish) {
    return translate('buildWeb.trains.publishesBuild', 'publishes build #{{n}}', {
      n: String(i.current.build_number)
    })
  }
  return i.current
    ? translate(
        'buildWeb.trains.notBuilt',
        'not built: the tasks’ commits are already in build #{{n}}',
        {
          n: String(i.current.build_number)
        }
      )
    : i.why.join(', ')
}

/** What would board if the window opened now — read-only, after build-web's preview. */
export function TrainPreviewDialog({
  target,
  train,
  onClose
}: {
  target: RuntimeClientTarget
  train: BuildWebTrain
  onClose: () => void
}): React.JSX.Element {
  const [preview, setPreview] = useState<BuildWebTrainPreview | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    callBuildWeb(target, 'trainPreview', { trainId: train.id })
      .then((next) => alive && setPreview(next))
      .catch(
        (failure) => alive && setError(failure instanceof Error ? failure.message : String(failure))
      )
    return () => {
      alive = false
    }
  }, [target, train.id])

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {translate('buildWeb.trains.previewTitle', 'What boards now — {{name}}', {
              name: train.name
            })}
          </DialogTitle>
          <DialogDescription>
            {translate(
              'buildWeb.trains.previewHint',
              'What the window would build and which tasks would ride along if it opened now.'
            )}
          </DialogDescription>
        </DialogHeader>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {!preview && !error ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        ) : null}
        {preview ? (
          <div className="scrollbar-sleek flex max-h-[70vh] flex-col gap-4 overflow-y-auto text-sm">
            {[
              ...preview.problems,
              ...Object.entries(preview.unbuildable).map(([image, reason]) =>
                translate('buildWeb.trains.unbuildable', '{{image}}: {{reason}} — left out', {
                  image,
                  reason
                })
              )
            ].map((line) => (
              <p
                key={line}
                className="rounded-md bg-chip-tone-amber/15 px-3 py-2 text-xs text-chip-tone-amber"
              >
                {line}
              </p>
            ))}
            <section className="flex flex-col gap-1.5">
              <h3 className="text-sm font-semibold">
                {translate('buildWeb.trains.imagesCount', 'Images ({{n}})', {
                  n: String(preview.images.length)
                })}
              </h3>
              {preview.images.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {translate(
                    'buildWeb.trains.noImagesQueued',
                    'nothing to build — no task in the queue has a build task with images'
                  )}
                </p>
              ) : (
                preview.images.map((i) => (
                  <div
                    key={`${i.image}|${i.dist}`}
                    className="grid grid-cols-[minmax(0,1.2fr)_80px_minmax(0,0.8fr)_minmax(0,1.2fr)] items-center gap-3 text-xs"
                  >
                    <span className="truncate font-mono">{i.image}</span>
                    <span>
                      <BuildWebToneChip label={i.dist} tone={null} />
                    </span>
                    <span className="truncate font-mono">{i.tickets.join(', ')}</span>
                    <span className="truncate text-muted-foreground" title={imageWhy(i)}>
                      {imageWhy(i)}
                    </span>
                  </div>
                ))
              )}
            </section>
            <section className="flex flex-col gap-1.5">
              <h3 className="text-sm font-semibold">
                {translate('buildWeb.trains.queue', 'Queue «{{status}}» in {{project}} ({{n}})', {
                  status: preview.from_status,
                  project: preview.project,
                  n: String(preview.tickets.length)
                })}
              </h3>
              {preview.tickets.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {translate(
                    'buildWeb.trains.queueEmpty',
                    'JQL returned nothing — check the status name'
                  )}
                </p>
              ) : (
                preview.tickets.map((t) => (
                  <div
                    key={t.key}
                    className={cn(
                      'grid grid-cols-[110px_minmax(0,1fr)_minmax(0,0.8fr)] items-center gap-3 text-xs',
                      !t.boards && 'opacity-60'
                    )}
                  >
                    <span className="font-mono">{t.key}</span>
                    <span className="truncate">{t.summary}</span>
                    <span className="truncate" title={t.reason ?? undefined}>
                      {t.boards ? (
                        <BuildWebToneChip
                          label={translate('buildWeb.trains.boards', 'boards')}
                          tone="green"
                        />
                      ) : (
                        <span className="text-muted-foreground">{t.reason}</span>
                      )}
                    </span>
                  </div>
                ))
              )}
            </section>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
