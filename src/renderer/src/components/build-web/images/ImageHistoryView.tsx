import { useEffect, useState } from 'react'
import { ArrowLeft, ExternalLink, Hammer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { translate } from '@/i18n/i18n'
import { isPushable } from '../../../../../shared/build-web-image-push'
import type { BuildWebImageBuild } from '../../../../../shared/build-web-image-types'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import {
  BuildStatusCell,
  LogCell,
  RegistryCell,
  buildStatusLabel,
  formatBuildTime
} from './image-build-cells'
import { FilterChips } from './FilterChips'
import { ImagePushMenu } from './ImagePushMenu'
import { useImagePicks } from './use-image-picks'
import { ImageBuildDialog } from './ImageBuildDialog'
import { ImageBuildProgress } from './ImageBuildProgress'
import { useBuildWebStore } from '../build-web-store'
import { BuildWebSortHeader } from '../BuildWebSortHeader'
import { BuildWebToneChip } from '../BuildWebToneChip'
import {
  FoundCount,
  ImagePages,
  ImageSearch,
  ImageTableState,
  VersionSelect
} from './image-view-parts'
import { IMAGE_PAGE_SIZE, toggled, useImageHistory, useImageSort } from './use-build-web-images'

const DISTS = ['rhel', 'redos'] as const
const PUSHED = ['yes', 'no'] as const
const STATUSES = ['success', 'failed', 'running'] as const
const RUNNING_REFRESH_MS = 20_000
const keyOf = (b: BuildWebImageBuild) => `${b.run_id}|${b.dist}|${b.number}`

export function ImageHistoryView({
  target,
  image,
  baseUrl,
  onBack
}: {
  target: RuntimeClientTarget
  image: string
  baseUrl: string | null
  onBack: () => void
}): React.JSX.Element {
  const [q, setQ] = useState('')
  const [dists, setDists] = useState<(typeof DISTS)[number][]>([])
  const [pushed, setPushed] = useState<(typeof PUSHED)[number][]>([])
  const [statuses, setStatuses] = useState<(typeof STATUSES)[number][]>([])
  const [version, setVersion] = useState('all')
  const [page, setPage] = useState(0)
  const picks = useImagePicks()
  const sorting = useImageSort(() => setPage(0))
  const args = {
    sort: sorting.sort ?? undefined,
    dir: sorting.dir,
    image,
    q,
    dists,
    pushed,
    statuses,
    version: version === 'all' ? undefined : version,
    page,
    pageSize: IMAGE_PAGE_SIZE
  }
  const { data, loading, error, reload } = useImageHistory(target, true, args)
  const builds = data?.builds ?? []
  const canBuild = useBuildWebStore((s) => s.status?.perms.includes('build') === true)
  const [building, setBuilding] = useState(false)
  const product = data?.builds[0]?.product || image.split('/')[0]
  const runningNow = data?.counts.statuses.running ?? 0
  // Why: a build started elsewhere (build-web, a train) shows its outcome without a manual refresh.
  useEffect(() => {
    if (!runningNow) {
      return
    }
    const timer = window.setInterval(() => reload(true), RUNNING_REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [reload, runningNow])
  const pushedLabel = (v: (typeof PUSHED)[number]) =>
    v === 'yes'
      ? translate('buildWeb.images.inRegistry', 'in registry')
      : translate('buildWeb.images.notPushed', 'not pushed')

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2 md:px-5">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft />
          {translate('buildWeb.images.allImages', 'All images')}
        </Button>
        <span className="font-mono text-sm font-semibold">{image}</span>
        {canBuild ? (
          <Button variant="outline" size="sm" onClick={() => setBuilding(true)}>
            <Hammer />
            {translate('buildWeb.imageBuild.open', 'Build…')}
          </Button>
        ) : null}
        {baseUrl ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              void window.api.shell.openUrl(`${baseUrl}/images?image=${encodeURIComponent(image)}`)
            }
          >
            {translate('buildWeb.images.openInBuildWeb', 'Open in build-web')}
            <ExternalLink />
          </Button>
        ) : null}
        <ImageSearch
          value={q}
          placeholder={translate('buildWeb.images.searchTag', 'Search by tag')}
          onChange={(next) => (setQ(next), setPage(0))}
        />
        <VersionSelect
          value={version}
          versions={data?.versions ?? []}
          onChange={(next) => (setVersion(next), setPage(0))}
        />
        <div className="flex-1" />
        <ImagePushMenu
          target={target}
          builds={picks.builds}
          onPushed={() => {
            picks.clear()
            reload(true)
          }}
        />
        <FoundCount shown={data?.total ?? 0} of={data?.of ?? 0} />
      </div>
      <div className="flex flex-wrap gap-1.5 px-3 py-2 md:px-5">
        <FilterChips
          options={DISTS}
          counts={data?.counts.dists ?? {}}
          selected={dists}
          label={(d) => d}
          onToggle={(d) => {
            setDists(toggled(dists, d))
            setPage(0)
          }}
        />
        <FilterChips
          options={PUSHED}
          counts={data?.counts.pushed ?? {}}
          selected={pushed}
          label={pushedLabel}
          onToggle={(v) => {
            setPushed(toggled(pushed, v))
            setPage(0)
          }}
        />
        <FilterChips
          options={STATUSES}
          counts={data?.counts.statuses ?? {}}
          selected={statuses}
          label={buildStatusLabel}
          onToggle={(s) => {
            setStatuses(toggled(statuses, s))
            setPage(0)
          }}
        />
      </div>
      <ImageBuildProgress target={target} image={image} onSettled={() => reload(true)} />
      <ImageBuildDialog
        open={building}
        onOpenChange={setBuilding}
        target={target}
        image={image}
        product={product}
      />
      <ImageTableState
        error={error}
        loading={loading}
        empty={builds.length === 0}
        emptyText={translate('buildWeb.images.noBuilds', 'No builds of this image match.')}
        onRetry={() => reload(true)}
      />
      {error || builds.length === 0 ? null : (
        <div className="scrollbar-sleek min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[820px] table-fixed border-collapse">
            <thead className="sticky top-0 z-10 bg-background">
              <tr className="border-b border-border text-left text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
                <th className="w-10 py-2 pl-3 md:pl-5">
                  <span className="sr-only">
                    {translate('buildWeb.list.selection', 'Selection')}
                  </span>
                </th>
                <BuildWebSortHeader
                  {...sorting}
                  sortKey="tag"
                  label={translate('buildWeb.images.tag', 'Tag')}
                  className="w-40"
                />
                <BuildWebSortHeader
                  {...sorting}
                  sortKey="version"
                  label={translate('buildWeb.images.versionShort', 'Version')}
                  className="w-24"
                />
                <BuildWebSortHeader
                  {...sorting}
                  sortKey="dist"
                  label={translate('buildWeb.images.dist', 'dist')}
                  className="w-16"
                />
                <BuildWebSortHeader
                  {...sorting}
                  sortKey="branch"
                  label={translate('buildWeb.images.branch', 'Branch')}
                />
                <BuildWebSortHeader
                  {...sorting}
                  sortKey="at"
                  label={translate('buildWeb.images.builtAt', 'Built')}
                  className="w-32"
                />
                <BuildWebSortHeader
                  {...sorting}
                  sortKey="status"
                  label={translate('buildWeb.images.status', 'Status')}
                  className="w-24"
                />
                <th className="w-20 py-2">{translate('buildWeb.images.log', 'Log')}</th>
                <BuildWebSortHeader
                  {...sorting}
                  sortKey="registry"
                  label={translate('buildWeb.images.registry', 'Registry')}
                  className="w-36 pr-3 md:pr-5"
                />
              </tr>
            </thead>
            <tbody>
              {builds.map((b) => (
                <tr key={keyOf(b)} className="border-b border-border hover:bg-accent">
                  <td className="py-2 pl-3 md:pl-5">
                    {/* Why no disabled box: a faded one reads the same as an empty one. */}
                    {isPushable(b) ? (
                      <Checkbox
                        emphasis="strong"
                        checked={picks.has(keyOf(b))}
                        onCheckedChange={() => picks.toggle(keyOf(b), b)}
                        aria-label={translate('buildWeb.images.pick', 'Pick {{image}}', {
                          image: b.tag ?? image
                        })}
                      />
                    ) : null}
                  </td>
                  <td className="py-2">
                    {b.tag ? <BuildWebToneChip label={b.tag} tone={null} mono /> : null}
                  </td>
                  <td className="py-2">
                    {b.product_version ? (
                      <BuildWebToneChip label={b.product_version} tone={null} mono />
                    ) : null}
                  </td>
                  <td className="py-2 text-xs">{b.dist}</td>
                  <td className="truncate py-2 font-mono text-xs text-muted-foreground">
                    {b.branch}
                  </td>
                  <td className="py-2 text-xs text-muted-foreground">{formatBuildTime(b.at)}</td>
                  <td className="py-2">
                    <BuildStatusCell build={b} />
                  </td>
                  <td className="py-2">
                    <LogCell build={b} />
                  </td>
                  <td className="py-2 pr-3 md:pr-5">
                    <RegistryCell build={b} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ImagePages total={data?.total ?? 0} page={page} loading={loading} onPageChange={setPage} />
    </div>
  )
}
