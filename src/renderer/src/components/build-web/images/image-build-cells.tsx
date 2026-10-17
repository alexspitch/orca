import { Badge } from '@/components/ui/badge'
import { translate } from '@/i18n/i18n'
import type { BuildWebImageBuild } from '../../../../../shared/build-web-image-types'

// Cells the image list and an image's history share, so both read as one table.

export function buildStatusLabel(status: BuildWebImageBuild['status']): string {
  switch (status) {
    case 'success':
      return translate('buildWeb.images.success', 'success')
    case 'failed':
      return translate('buildWeb.images.failed', 'failed')
    case 'running':
      return translate('buildWeb.images.running', 'running')
  }
}

export function BuildStatusCell({ build }: { build: BuildWebImageBuild }): React.JSX.Element {
  return (
    <Badge
      variant={
        build.status === 'failed'
          ? 'destructive'
          : build.status === 'running'
            ? 'secondary'
            : 'outline'
      }
      title={build.raw_status}
    >
      {buildStatusLabel(build.status)}
    </Badge>
  )
}

/** Where the build stands in the registry — build-web's «В repo» column. */
export function RegistryCell({ build }: { build: BuildWebImageBuild }): React.JSX.Element | null {
  if (build.status !== 'success' || !build.ref) {
    return null
  }
  if (build.pushed_build_tag && build.pushed_main_tag) {
    return <Badge variant="outline">{translate('buildWeb.images.pushed', 'pushed')}</Badge>
  }
  if (build.pushed_build_tag) {
    return (
      <Badge variant="outline">{translate('buildWeb.images.buildTagOnly', 'build tag only')}</Badge>
    )
  }
  return (
    <span className="text-xs text-muted-foreground">
      {translate('buildWeb.images.notPushed', 'not pushed')}
    </span>
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
      onClick={() => void window.api.shell.openUrl(url)}
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
