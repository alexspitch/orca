import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
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
import { cn } from '@/lib/utils'
import { isPushable } from '../../../../../shared/build-web-image-push'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import { BuildWebListState } from '../BuildWebListState'
import { BuildStatusCell, LogCell, RegistryCell, formatBuildTime } from './image-build-cells'
import { FilterChips } from './FilterChips'
import { ImagePushMenu } from './ImagePushMenu'
import { useImagePicks } from './use-image-picks'
import { IMAGE_PAGE_SIZE, toggled, useImagePage } from './use-build-web-images'

const PRODUCTS = ['dc', 'sa', 'ap', 'storage', 'other'] as const
const DISTS = ['rhel', 'redos'] as const
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
  const args = {
    q,
    products,
    dists,
    version: version === 'all' ? undefined : version,
    page,
    pageSize: IMAGE_PAGE_SIZE
  }
  const { data, loading, error, reload } = useImagePage(target, true, args)
  const rows = data?.rows ?? []
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
        <Input
          value={q}
          onChange={(event) => {
            setQ(event.target.value)
            setPage(0)
          }}
          placeholder={translate('buildWeb.images.search', 'Search by image or tag')}
          aria-label={translate('buildWeb.images.search', 'Search by image or tag')}
          className="h-8 w-64"
          data-escape-clears-value="true"
        />
        <Select value={version} onValueChange={(next) => (setVersion(next), setPage(0))}>
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
        <span className="text-xs whitespace-nowrap text-muted-foreground">
          {translate('buildWeb.images.found', '{{shown}} of {{of}}', {
            shown: data?.total ?? 0,
            of: data?.of ?? 0
          })}
        </span>
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
      {error ? (
        <BuildWebListState kind="error" error={error} onRetry={() => reload(true)} />
      ) : rows.length === 0 ? (
        loading ? (
          <BuildWebListState
            kind="loading"
            loadingLabel={translate('buildWeb.images.loading', 'Loading images…')}
          />
        ) : (
          <p className="px-3 py-10 text-center text-sm text-muted-foreground md:px-5">
            {narrowed
              ? translate('buildWeb.images.noneFiltered', 'Nothing matches these filters.')
              : translate('buildWeb.images.none', 'No images.')}
          </p>
        )
      ) : (
        <div className="scrollbar-sleek min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[900px] table-fixed border-collapse">
            <thead className="sticky top-0 z-10 bg-background">
              <tr className="border-b border-border text-left text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
                <th className="w-10 py-2 pl-3 md:pl-5">
                  <span className="sr-only">
                    {translate('buildWeb.list.selection', 'Selection')}
                  </span>
                </th>
                <th className="py-2">{translate('buildWeb.images.image', 'Image')}</th>
                <th className="w-24 py-2">{translate('buildWeb.images.product', 'Product')}</th>
                <th className="w-24 py-2">
                  {translate('buildWeb.images.versionShort', 'Version')}
                </th>
                <th className="w-16 py-2">{translate('buildWeb.images.dist', 'dist')}</th>
                <th className="w-32 py-2">
                  {translate('buildWeb.images.lastBuild', 'Last build')}
                </th>
                <th className="w-24 py-2">{translate('buildWeb.images.status', 'Status')}</th>
                <th className="w-20 py-2">{translate('buildWeb.images.log', 'Log')}</th>
                <th className="w-36 py-2 pr-3 md:pr-5">
                  {translate('buildWeb.images.registry', 'Registry')}
                </th>
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
                      <Checkbox
                        disabled={!pushable}
                        checked={picks.has(row.image)}
                        onCheckedChange={() => picks.toggle(row.image, row.last)}
                        aria-label={translate('buildWeb.images.pick', 'Pick {{image}}', {
                          image: row.image
                        })}
                      />
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
                      <Badge variant="secondary">{productName(row.product)}</Badge>
                    </td>
                    <td className="py-2 font-mono text-xs">{row.last?.version ?? ''}</td>
                    <td className="py-2 text-xs">{row.last?.dist ?? ''}</td>
                    <td className="py-2 text-xs text-muted-foreground">
                      {formatBuildTime(row.last?.at ?? null)}
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
