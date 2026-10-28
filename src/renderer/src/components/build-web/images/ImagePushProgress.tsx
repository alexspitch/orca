import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type {
  BuildWebImageBuild,
  BuildWebPushProgress
} from '../../../../../shared/build-web-image-types'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import { callBuildWeb } from '../build-web-client'
import { BuildWebToneChip } from '../BuildWebToneChip'
import {
  areTwinsGoing,
  isPushFollowed,
  isPushOver,
  progressNews,
  twinPushOf,
  type TwinPush
} from '../../../../../shared/build-web-image-tracking'
import { useImagePushes, type TrackedImagePush } from './image-push-runs'
import { RegistryCell } from './image-build-cells'

const POLL_MS = 1500

function headline(push: TrackedImagePush, progress: BuildWebPushProgress | undefined): string {
  const n = String(push.keys.length)
  if (!isPushOver(progress)) {
    return translate('buildWeb.push.going', 'Pushing {{n}} image(s)…', { n })
  }
  if (progress?.state === 'unknown') {
    return translate(
      'buildWeb.push.unknown',
      'build-web did not report this push; the table shows what the registry holds'
    )
  }
  const finished = translate(
    'buildWeb.push.finished',
    'Push finished: {{ok}} pushed, {{failed}} failed',
    { ok: String(progress?.ok.length ?? 0), failed: String(progress?.failed.length ?? 0) }
  )
  return areTwinsGoing(progress)
    ? `${finished} · ${translate('buildWeb.push.twinsGoing', 'redos being made and pushed…')}`
    : finished
}

function twinChip(twin: TwinPush): React.JSX.Element {
  switch (twin) {
    case 'pushed':
      return (
        <BuildWebToneChip
          label={translate('buildWeb.push.twinPushed', 'redos pushed')}
          tone="green"
        />
      )
    case 'made':
      return (
        <BuildWebToneChip label={translate('buildWeb.push.twinMade', 'redos made')} tone="amber" />
      )
    case 'failed':
      return (
        <BuildWebToneChip
          label={translate('buildWeb.push.twinFailed', 'redos failed')}
          tone="red"
        />
      )
    case 'going':
      return (
        <span className="inline-flex items-center gap-1">
          <Loader2 className="size-3 animate-spin text-chip-tone-blue" />
          <BuildWebToneChip label={translate('buildWeb.push.twinGoing', 'redos…')} tone="blue" />
        </span>
      )
  }
}

function imageChip(key: string, progress: BuildWebPushProgress | undefined): React.JSX.Element {
  if (progress?.ok.includes(key)) {
    return <BuildWebToneChip label={translate('buildWeb.images.pushed', 'pushed')} tone="green" />
  }
  if (progress?.failed.includes(key)) {
    return <BuildWebToneChip label={translate('buildWeb.push.failed', 'push failed')} tone="red" />
  }
  if (isPushOver(progress)) {
    return <BuildWebToneChip label={translate('buildWeb.push.noAnswer', 'no answer')} tone={null} />
  }
  return (
    <span className="inline-flex items-center gap-1">
      <Loader2 className="size-3 animate-spin text-chip-tone-amber" />
      <BuildWebToneChip label={translate('buildWeb.run.pushing', 'pushing…')} tone="amber" />
    </span>
  )
}

function PushCard({
  push,
  progress
}: {
  push: TrackedImagePush
  progress: BuildWebPushProgress | undefined
}): React.JSX.Element {
  const dismiss = useImagePushes((s) => s.dismiss)
  const [showLog, setShowLog] = useState(false)
  const logRef = useRef<HTMLPreElement>(null)
  const lines = progress?.lines ?? []
  const going = !isPushOver(progress) || areTwinsGoing(progress)
  useEffect(() => {
    logRef.current?.scrollTo(0, logRef.current.scrollHeight)
  }, [lines.length, showLog])
  return (
    <section className="flex flex-col gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm">
      <div className="flex items-center gap-2">
        {going ? <Loader2 className="size-3.5 animate-spin text-muted-foreground" /> : null}
        <span className="font-medium">{headline(push, progress)}</span>
        <span className="text-xs text-muted-foreground">
          {new Date(push.startedAt).toLocaleTimeString()}
        </span>
        <div className="flex-1" />
        {lines.length ? (
          <Button variant="ghost" size="xs" onClick={() => setShowLog((v) => !v)}>
            {showLog
              ? translate('buildWeb.push.hideLog', 'Hide log')
              : translate('buildWeb.push.log', 'Log')}
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => dismiss(push.runId)}
          aria-label={translate('buildWeb.imageBuild.dismiss', 'Hide')}
        >
          <X />
        </Button>
      </div>
      <div className="flex flex-col gap-1">
        {push.keys.map((key) => {
          const [image, dist] = key.split('|')
          const twin = twinPushOf(progress, key)
          return (
            <div key={key} className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-mono">{image}</span>
              <span className="text-muted-foreground">{dist}</span>
              {imageChip(key, progress)}
              {twin ? twinChip(twin) : null}
            </div>
          )
        })}
      </div>
      {going && lines.length && !showLog ? (
        <p className="truncate font-mono text-2xs text-muted-foreground">{lines.at(-1)}</p>
      ) : null}
      {showLog ? (
        <pre
          ref={logRef}
          className="scrollbar-sleek max-h-48 overflow-auto rounded-md bg-muted/60 p-2 font-mono text-2xs whitespace-pre-wrap"
        >
          {lines.join('\n')}
        </pre>
      ) : null}
      {progress?.error ? <p className="text-xs text-destructive">{progress.error}</p> : null}
    </section>
  )
}

// Why ten seconds at most: the table's registry and status must follow a push while it goes.
const TABLE_REFRESH_MS = 8_000

/** A row's place in a push still going: its own outcome once known, else pushing; null outside one. */
export function useRowPushProgress(key: string): BuildWebPushProgress | null {
  return useImagePushes((s) => {
    for (const push of s.pushes) {
      const progress = s.progress[push.runId]
      if (push.keys.includes(key) && !isPushOver(progress)) {
        return progress ?? null
      }
    }
    return null
  })
}

/** The row's registry: what a push going does to it while it goes, else what the registry holds. */
export function RowRegistryCell({
  rowKey,
  build
}: {
  rowKey: string
  build: BuildWebImageBuild
}): React.JSX.Element {
  const going = useImagePushes((s) =>
    s.pushes.some((p) => p.keys.includes(rowKey) && !isPushOver(s.progress[p.runId]))
  )
  const progress = useRowPushProgress(rowKey)
  return going ? imageChip(rowKey, progress ?? undefined) : <RegistryCell build={build} />
}

/**
 * Re-reads the table while any push goes: every few seconds, and at once when an image of it ends,
 * so a row's registry and status follow the push instead of waiting for the whole of it.
 */
export function useTableFollowsPushes(reload: () => void): void {
  const going = useImagePushes((s) => s.pushes.some((p) => !isPushOver(s.progress[p.runId])))
  const finished = useImagePushes((s) =>
    s.pushes.reduce(
      (n, p) =>
        n + (s.progress[p.runId]?.ok.length ?? 0) + (s.progress[p.runId]?.failed.length ?? 0),
      0
    )
  )
  const reloadRef = useRef(reload)
  reloadRef.current = reload
  useEffect(() => {
    if (going && finished > 0) {
      reloadRef.current()
    }
  }, [finished, going])
  useEffect(() => {
    if (!going) {
      return
    }
    const timer = window.setInterval(() => reloadRef.current(), TABLE_REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [going])
}

/**
 * The pushes started from this window, read every moment from the host that follows them; when
 * one ends the table is read again, so its registry column shows what was published.
 */
export function ImagePushProgress({
  target,
  image,
  onSettled
}: {
  target: RuntimeClientTarget
  image?: string
  onSettled: () => void
}): React.JSX.Element | null {
  const all = useImagePushes((s) => s.pushes)
  const progress = useImagePushes((s) => s.progress)
  const setProgress = useImagePushes((s) => s.setProgress)
  const pushes = useMemo(
    () => (image ? all.filter((p) => p.keys.some((k) => k.startsWith(`${image}|`))) : all),
    [all, image]
  )
  const goingIds = all
    .filter((p) => isPushFollowed(progress[p.runId]))
    .map((p) => p.runId)
    .join(',')
  const settledRef = useRef(onSettled)
  settledRef.current = onSettled

  useEffect(() => {
    if (!goingIds) {
      return
    }
    let alive = true
    const read = async (): Promise<void> => {
      try {
        const list = await callBuildWeb(target, 'pushProgress', { runIds: goingIds.split(',') })
        if (!alive) {
          return
        }
        const { pushEnded, twinsEnded } = progressNews(useImagePushes.getState().progress, list)
        setProgress(list)
        if (pushEnded.length || twinsEnded.length) {
          settledRef.current()
          // Why again: a table read in the same moment the console writes the flags shows the old ones.
          window.setTimeout(() => settledRef.current(), 3000)
        }
        for (const p of pushEnded) {
          if (p.failed.length) {
            toast.error(
              translate('buildWeb.push.toastFailed', '{{n}} image(s) were not pushed', {
                n: String(p.failed.length)
              })
            )
          } else if (p.ok.length) {
            toast.success(
              translate('buildWeb.push.toastDone', '{{n}} image(s) pushed', {
                n: String(p.ok.length)
              })
            )
          }
        }
        for (const p of twinsEnded) {
          if (p.redos?.failed.length) {
            toast.error(
              translate('buildWeb.push.toastTwinsFailed', 'redos of {{images}} not made', {
                images: p.redos.failed.join(', ')
              })
            )
          }
        }
      } catch {
        // A blip: the next beat asks again.
      }
    }
    const timer = window.setInterval(() => void read(), POLL_MS)
    void read()
    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [goingIds, setProgress, target])

  if (pushes.length === 0) {
    return null
  }
  return (
    <div className="flex flex-col gap-2 px-3 pb-2 md:px-5">
      {pushes.map((push) => (
        <PushCard key={push.runId} push={push} progress={progress[push.runId]} />
      ))}
    </div>
  )
}
