import { useState } from 'react'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { PaginationBar } from '@/components/task-page/PaginationBar'
import { translate } from '@/i18n/i18n'
import { isPushable } from '../../../../../shared/build-web-image-push'
import type { BuildWebImageBuild } from '../../../../../shared/build-web-image-types'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import { BuildWebListState } from '../BuildWebListState'
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
import { IMAGE_PAGE_SIZE, toggled, useImageHistory } from './use-build-web-images'

const DISTS = ['rhel', 'redos'] as const
const PUSHED = ['yes', 'no'] as const
const STATUSES = ['success', 'failed', 'running'] as const
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
  const args = {
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
        {baseUrl ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              void window.api.shell.openUrl(`${baseUrl}/images?image=${encodeURIComponent(image)}`)
            }
          >
            {translate('buildWeb.images.buildInBuildWeb', 'Build in build-web')}
            <ExternalLink />
          </Button>
        ) : null}
        <Input
          value={q}
          onChange={(event) => {
            setQ(event.target.value)
            setPage(0)
          }}
          placeholder={translate('buildWeb.images.searchTag', 'Search by tag')}
          aria-label={translate('buildWeb.images.searchTag', 'Search by tag')}
          className="h-8 w-48"
          data-escape-clears-value="true"
        />
        <Select
          value={version}
          onValueChange={(next) => {
            setVersion(next)
            setPage(0)
          }}
        >
          <SelectTrigger
            size="sm"
            aria-label={translate('buildWeb.images.version', 'Product version')}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {translate('buildWeb.images.allVersions', 'All versions')}
            </SelectItem>
            {(data?.versions ?? []).map((v) => (
              <SelectItem key={v} value={v}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <ImagePushMenu
          target={target}
          builds={picks.builds}
          onPushed={() => {
            picks.clear()
            reload(true)
          }}
        />
        <span className="text-xs whitespace-nowrap text-muted-foreground">
          {translate('buildWeb.images.found', '{{shown}} of {{of}}', {
            shown: data?.total ?? 0,
            of: data?.of ?? 0
          })}
        </span>
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
      {error ? (
        <BuildWebListState kind="error" error={error} onRetry={() => reload(true)} />
      ) : builds.length === 0 ? (
        loading ? (
          <BuildWebListState
            kind="loading"
            loadingLabel={translate('buildWeb.images.loading', 'Loading images…')}
          />
        ) : (
          <p className="px-3 py-10 text-center text-sm text-muted-foreground md:px-5">
            {translate('buildWeb.images.noBuilds', 'No builds of this image match.')}
          </p>
        )
      ) : (
        <div className="scrollbar-sleek min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[820px] table-fixed border-collapse">
            <thead className="sticky top-0 z-10 bg-background">
              <tr className="border-b border-border text-left text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
                <th className="w-10 py-2 pl-3 md:pl-5">
                  <span className="sr-only">
                    {translate('buildWeb.list.selection', 'Selection')}
                  </span>
                </th>
                <th className="w-40 py-2">{translate('buildWeb.images.tag', 'Tag')}</th>
                <th className="w-24 py-2">
                  {translate('buildWeb.images.versionShort', 'Version')}
                </th>
                <th className="w-16 py-2">{translate('buildWeb.images.dist', 'dist')}</th>
                <th className="py-2">{translate('buildWeb.images.branch', 'Branch')}</th>
                <th className="w-32 py-2">{translate('buildWeb.images.builtAt', 'Built')}</th>
                <th className="w-24 py-2">{translate('buildWeb.images.status', 'Status')}</th>
                <th className="w-20 py-2">{translate('buildWeb.images.log', 'Log')}</th>
                <th className="w-36 py-2 pr-3 md:pr-5">
                  {translate('buildWeb.images.registry', 'Registry')}
                </th>
              </tr>
            </thead>
            <tbody>
              {builds.map((b) => (
                <tr key={keyOf(b)} className="border-b border-border hover:bg-accent">
                  <td className="py-2 pl-3 md:pl-5">
                    <Checkbox
                      disabled={!isPushable(b)}
                      checked={picks.has(keyOf(b))}
                      onCheckedChange={() => picks.toggle(keyOf(b), b)}
                      aria-label={translate('buildWeb.images.pick', 'Pick {{image}}', {
                        image: b.tag ?? image
                      })}
                    />
                  </td>
                  <td className="truncate py-2 font-mono text-xs">{b.tag ?? ''}</td>
                  <td className="py-2 text-xs">{b.product_version ?? ''}</td>
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
      {data && data.total > IMAGE_PAGE_SIZE ? (
        <PaginationBar
          currentPage={page}
          totalPages={Math.ceil(data.total / IMAGE_PAGE_SIZE)}
          loadingTarget={loading ? page : null}
          onPageChange={setPage}
        />
      ) : null}
    </div>
  )
}
