import { useEffect, useState } from 'react'
import { Hammer, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { isPushable } from '../../../../../shared/build-web-image-push'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import { BuildStatusCell, LogCell, RegistryCell, formatBuildTime } from './image-build-cells'
import { FilterChips } from './FilterChips'
import { ImagePushMenu } from './ImagePushMenu'
import { useImagePicks } from './use-image-picks'
import { ImageBuildDialog } from './ImageBuildDialog'
import { ImageBuildProgress } from './ImageBuildProgress'
import { useBuildWebStore } from '../build-web-store'
import { BuildWebSortHeader } from '../BuildWebSortHeader'
import { BuildWebToneChip } from '../BuildWebToneChip'
import { productTone } from '../build-web-tones'
import {
  FoundCount,
  ImagePages,
  ImageSearch,
  ImageTableState,
  VersionSelect
} from './image-view-parts'
import { IMAGE_PAGE_SIZE, toggled, useImagePage, useImageSort } from './use-build-web-images'

const PRODUCTS = ['dc', 'sa', 'ap', 'storage', 'other'] as const
const DISTS = ['rhel', 'redos'] as const
const RUNNING_REFRESH_MS = 20_000
const productName = (p: string) =>
  p === 'other'
    ? translate('buildWeb.images.other', 'Other')
    : p === 'storage'
      ? 'Storage'
      : p.toUpperCase()

export function ImageListView({
  target,
  onOpenImage
}: {
  target: RuntimeClientTarget
  onOpenImage: (image: string) => void
}): React.JSX.Element {
  const [q, setQ] = useState('')
  const [products, setProducts] = useState<string[]>([])
  const [dists, setDists] = useState<string[]>([])
  const [version, setVersion] = useState('all')
  const [page, setPage] = useState(0)
  const picks = useImagePicks()
  const sorting = useImageSort(() => setPage(0))
  const args = {
    sort: sorting.sort ?? undefined,
    dir: sorting.dir,
    q,
    products,
    dists,
    version: version === 'all' ? undefined : version,
    page,
    pageSize: IMAGE_PAGE_SIZE
  }
  const { data, loading, error, reload } = useImagePage(target, true, args)
  const rows = data?.rows ?? []
  const canBuild = useBuildWebStore((s) => s.status?.perms.includes('build') === true)
  const [building, setBuilding] = useState<{
    image: string
    product: string
    branch?: string
  } | null>(null)
  const anyRunning = rows.some((r) => r.last?.status === 'running')
  // Why: builds going on the console show their outcome without a manual refresh.
  useEffect(() => {
    if (!anyRunning) {
      return
    }
    const timer = window.setInterval(() => reload(true), RUNNING_REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [anyRunning, reload])
  const narrowed = Boolean(q.trim() || products.length || dists.length || version !== 'all')
  const reset = () => {
    setQ('')
    setProducts([])
    setDists([])
    setVersion('all')
    setPage(0)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2 md:px-5">
        <ImageSearch
          value={q}
          wide
          placeholder={translate('buildWeb.images.search', 'Search by image or tag')}
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
          onPushed={() => (picks.clear(), reload(true))}
        />
        {narrowed ? (
          <Button variant="ghost" size="sm" onClick={reset}>
            {translate('buildWeb.images.reset', 'Reset')}
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => reload(true)}
          disabled={loading}
          aria-label={translate('buildWeb.page.refresh', 'Refresh')}
        >
          <RefreshCw />
        </Button>
        <FoundCount shown={data?.total ?? 0} of={data?.of ?? 0} />
      </div>
      <div className="flex flex-wrap gap-1.5 px-3 py-2 md:px-5">
        <FilterChips
          options={PRODUCTS}
          counts={data?.counts.products ?? {}}
          selected={products}
          label={productName}
          onToggle={(p) => (setProducts(toggled(products, p)), setPage(0))}
        />
        <FilterChips
          options={DISTS}
          counts={data?.counts.dists ?? {}}
          selected={dists}
          label={(d) => d}
          onToggle={(d) => (setDists(toggled(dists, d)), setPage(0))}
        />
      </div>
      <ImageBuildProgress target={target} onSettled={() => reload(true)} />
      <ImageBuildDialog
        open={building !== null}
        onOpenChange={(open) => !open && setBuilding(null)}
        target={target}
        image={building?.image ?? ''}
        product={building?.product ?? ''}
        initialBranch={building?.branch}
      />
      <ImageTableState
        error={error}
        loading={loading}
        empty={rows.length === 0}
        emptyText={
          narrowed
            ? translate('buildWeb.images.noneFiltered', 'Nothing matches these filters.')
            : translate('buildWeb.images.none', 'No images.')
        }
        onRetry={() => reload(true)}
      />
      {error || rows.length === 0 ? null : (
        <div className="scrollbar-sleek min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[900px] table-fixed border-collapse">
            <thead className="sticky top-0 z-10 bg-background">
              <tr className="border-b border-border text-left text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
                <th className="w-10 py-2 pl-3 md:pl-5">
                  <span className="sr-only">
                    {translate('buildWeb.list.selection', 'Selection')}
                  </span>
                </th>
                <BuildWebSortHeader
                  {...sorting}
                  sortKey="image"
                  label={translate('buildWeb.images.image', 'Image')}
                />
                <BuildWebSortHeader
                  {...sorting}
                  sortKey="product"
                  label={translate('buildWeb.images.product', 'Product')}
                  className="w-24"
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
                  sortKey="at"
                  label={translate('buildWeb.images.lastBuild', 'Last build')}
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
              {rows.map((row) => {
                const pushable = Boolean(row.last && isPushable(row.last))
                return (
                  <tr
                    key={row.image}
                    className={cn(
                      'border-b border-border hover:bg-accent',
                      picks.has(row.image) && 'bg-accent'
                    )}
                  >
                    <td className="py-2 pl-3 md:pl-5">
                      {/* Why no disabled box: a faded one reads the same as an empty one. */}
                      {pushable ? (
                        <Checkbox
                          emphasis="strong"
                          checked={picks.has(row.image)}
                          onCheckedChange={() => picks.toggle(row.image, row.last)}
                          aria-label={translate('buildWeb.images.pick', 'Pick {{image}}', {
                            image: row.image
                          })}
                        />
                      ) : null}
                    </td>
                    <td className="max-w-0 py-2">
                      <button
                        type="button"
                        onClick={() => onOpenImage(row.image)}
                        className="block w-full truncate text-left font-mono text-xs hover:underline"
                      >
                        {row.image}
                      </button>
                    </td>
                    <td className="py-2">
                      <BuildWebToneChip
                        label={productName(row.product)}
                        tone={productTone(row.product)}
                      />
                    </td>
                    <td className="py-2">
                      {row.last?.version ? (
                        <BuildWebToneChip label={row.last.version} tone={null} mono />
                      ) : null}
                    </td>
                    <td className="py-2 text-xs">{row.last?.dist ?? ''}</td>
                    <td className="py-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        {formatBuildTime(row.last?.at ?? null)}
                        {canBuild ? (
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() =>
                              setBuilding({
                                image: row.image,
                                product: row.product,
                                branch: row.last?.branch || undefined
                              })
                            }
                            aria-label={translate(
                              'buildWeb.imageBuild.buildImage',
                              'Build {{image}}',
                              {
                                image: row.image
                              }
                            )}
                            title={translate('buildWeb.imageBuild.again', 'Start a build')}
                          >
                            <Hammer />
                          </Button>
                        ) : null}
                      </span>
                    </td>
                    <td className="py-2">
                      {row.last ? <BuildStatusCell build={row.last} /> : null}
                    </td>
                    <td className="py-2">{row.last ? <LogCell build={row.last} /> : null}</td>
                    <td className="py-2 pr-3 md:pr-5">
                      {row.last ? <RegistryCell build={row.last} /> : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <ImagePages total={data?.total ?? 0} page={page} loading={loading} onPageChange={setPage} />
    </div>
  )
}
