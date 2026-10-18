import { Loader2 } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import type { BuildWebImageBuild } from '../../../../../shared/build-web-image-types'
import { BuildWebToneChip } from '../BuildWebToneChip'
import { useBuildLogViewer } from './build-log-viewer'
import { pushStateOf, useImagePushes } from './image-push-runs'
import { imageBuildTone } from '../build-web-tones'

// Cells the image list and an image's history share, so both read as one table.

export function buildStatusLabel(status: BuildWebImageBuild['status']): string {
  switch (status) {
    case 'success':
      return translate('buildWeb.images.success', 'success')
    case 'failed':
      return translate('buildWeb.images.failed', 'failed')
    case 'running':
      return translate('buildWeb.images.inProgress', 'in progress')
  }
}

export function BuildStatusCell({ build }: { build: BuildWebImageBuild }): React.JSX.Element {
  return (
    <span title={build.raw_status} className="inline-flex items-center gap-1">
      {build.status === 'running' ? (
        <Loader2 className="size-3 animate-spin text-chip-tone-cyan" />
      ) : null}
      <BuildWebToneChip
        label={buildStatusLabel(build.status)}
        tone={imageBuildTone(build.status)}
      />
    </span>
  )
}

/** Where the build stands in the registry — build-web's «В repo»: pushed green, the rest amber. */
export function RegistryCell({ build }: { build: BuildWebImageBuild }): React.JSX.Element | null {
  // A push started from this window says so until the table reads its outcome.
  const push = useImagePushes((s) => pushStateOf(s, build))
  if (build.status !== 'success' || !build.ref) {
    return null
  }
  if (push === 'pushing') {
    return (
      <span className="inline-flex items-center gap-1">
        <Loader2 className="size-3 animate-spin text-chip-tone-amber" />
        <BuildWebToneChip label={translate('buildWeb.run.pushing', 'pushing…')} tone="amber" />
      </span>
    )
  }
  if (push === 'failed') {
    return <BuildWebToneChip label={translate('buildWeb.push.failed', 'push failed')} tone="red" />
  }
  if (build.pushed_build_tag && build.pushed_main_tag) {
    return <BuildWebToneChip label={translate('buildWeb.images.pushed', 'pushed')} tone="green" />
  }
  return (
    <BuildWebToneChip
      label={
        build.pushed_build_tag
          ? translate('buildWeb.images.buildTagOnly', 'build tag only')
          : translate('buildWeb.images.notPushed', 'not pushed')
      }
      tone="amber"
    />
  )
}

export function LogCell({ build }: { build: BuildWebImageBuild }): React.JSX.Element | null {
  const url = build.url
  if (!url || !/^https?:\/\//.test(url)) {
    return null
  }
  return (
    <button
      type="button"
      onClick={() =>
        useBuildLogViewer.getState().show(url, `${build.image} (${build.dist}) #${build.number}`)
      }
      className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
    >
      #{build.number}
    </button>
  )
}

export function formatBuildTime(at: string | null): string {
  if (!at) {
    return ''
  }
  const date = new Date(at)
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleString(undefined, {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
}
