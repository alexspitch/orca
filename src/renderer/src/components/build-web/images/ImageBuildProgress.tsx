import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type { BuildWebRun } from '../../../../../shared/build-web-run-types'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import { callBuildWeb } from '../build-web-client'
import { BuildWebToneChip } from '../BuildWebToneChip'
import { runStatusTone } from '../build-web-tones'
import { useBuildLogViewer } from './build-log-viewer'
import {
  isBuildGoing,
  useImageBuildRuns,
  versionOfBranch,
  type TrackedImageBuild
} from './image-build-runs'

const POLL_MS = 3000

/** One started build, read every few seconds until each of its builds has an outcome. */
function RunProgress({
  target,
  run,
  onSettled
}: {
  target: RuntimeClientTarget
  run: TrackedImageBuild
  onSettled: () => void
}): React.JSX.Element {
  const dismiss = useImageBuildRuns((s) => s.dismiss)
  const [answer, setAnswer] = useState<BuildWebRun | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const settled = useRef(false)
  const builds = (answer?.builds ?? []).filter((b) => b.image === run.image)
  const going =
    answer === undefined || builds.length === 0 || builds.some((b) => isBuildGoing(b.status))

  useEffect(() => {
    if (!going && answer !== undefined) {
      if (!settled.current) {
        settled.current = true
        onSettled()
      }
      return
    }
    let alive = true
    const read = async (): Promise<void> => {
      try {
        const next = await callBuildWeb(target, 'getRun', { runId: run.runId })
        if (alive) {
          setAnswer(next)
          setError(null)
        }
      } catch (failure) {
        if (alive) {
          setError(failure instanceof Error ? failure.message : String(failure))
        }
      }
    }
    const timer = window.setTimeout(() => void read(), answer === undefined ? 0 : POLL_MS)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [answer, going, onSettled, run.runId, target])

  return (
    <section className="flex flex-col gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm">
      <div className="flex items-center gap-2">
        {going ? <Loader2 className="size-3.5 animate-spin text-muted-foreground" /> : null}
        <span className="font-medium">
          {going
            ? translate('buildWeb.imageBuild.going', 'Building {{image}}…', { image: run.image })
            : translate('buildWeb.imageBuild.finished', 'Build of {{image}} finished', {
                image: run.image
              })}
        </span>
        <span className="text-xs text-muted-foreground">
          {new Date(run.startedAt).toLocaleTimeString()}
        </span>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => dismiss(run.runId)}
          aria-label={translate('buildWeb.imageBuild.dismiss', 'Hide')}
        >
          <X />
        </Button>
      </div>
      {answer === null ? (
        <p className="text-xs text-muted-foreground">
          {translate('buildWeb.imageBuild.gone', 'build-web no longer has this build.')}
        </p>
      ) : null}
      {builds.map((b) => (
        <div key={`${b.dist}|${b.branch}`} className="flex flex-wrap items-center gap-2 text-xs">
          <span className="w-12">{b.dist}</span>
          <BuildWebToneChip label={versionOfBranch(b.branch)} tone={null} mono />
          <span className="inline-flex items-center gap-1">
            {isBuildGoing(b.status) ? <Loader2 className="size-3 animate-spin" /> : null}
            <BuildWebToneChip label={b.status} tone={runStatusTone(b.status)} />
          </span>
          {b.url ? (
            <button
              type="button"
              onClick={() =>
                b.url &&
                useBuildLogViewer
                  .getState()
                  .show(b.url, `${b.image} (${b.dist}) #${b.number ?? ''}`)
              }
              className="text-muted-foreground hover:text-foreground hover:underline"
            >
              #{b.number ?? '—'}
            </button>
          ) : null}
          {b.error ? <span className="text-destructive">{b.error}</span> : null}
        </div>
      ))}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </section>
  )
}

/** The builds started from this window — for one image, or all of them — newest first. */
export function ImageBuildProgress({
  target,
  image,
  onSettled
}: {
  target: RuntimeClientTarget
  image?: string
  onSettled: () => void
}): React.JSX.Element | null {
  const all = useImageBuildRuns((s) => s.runs)
  const runs = useMemo(() => (image ? all.filter((r) => r.image === image) : all), [all, image])
  if (runs.length === 0) {
    return null
  }
  return (
    <div className="flex flex-col gap-2 px-3 pb-2 md:px-5">
      {runs.map((run) => (
        <RunProgress key={run.runId} target={target} run={run} onSettled={onSettled} />
      ))}
    </div>
  )
}
