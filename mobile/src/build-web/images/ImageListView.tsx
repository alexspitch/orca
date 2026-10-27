import { useState } from 'react'
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { FilterX, Hammer } from 'lucide-react-native'
import type {
  BuildWebImageRow,
  BuildWebImageSort
} from '../../../../src/shared/build-web-image-types'
import { pushesGoing } from '../../../../src/shared/build-web-image-tracking'
import { productTone } from '../../../../src/renderer/src/components/build-web/build-web-tones'
import {
  NO_IMAGE_FILTERS,
  type ImageFilters
} from '../../../../src/renderer/src/components/build-web/build-web-view-prefs'
import { imageRefOf } from '../../../../src/renderer/src/components/build-web/images/image-links'
import { useImagePicks } from './use-image-picks'
import { colors, spacing } from '../../theme/mobile-theme'
import { useBuildWebScreen } from '../build-web-screen-context'
import { BuildWebToneChip } from '../BuildWebToneChip'
import { FilterPill } from '../list/list-controls'
import { BuildTabTick } from '../issue/tabs/build/BuildTabControls'
import { ImageActionBar } from './ImageActionBar'
import type { ImageBuildChoice } from './ImageBuildSheet'
import {
  BuildStatusChip,
  LogLink,
  RowRegistryChip,
  buildStatusLabel,
  formatBuildTime,
  type OpenImageLog
} from './image-cells'
import { FreshnessChip, useImageFreshness } from './image-freshness'
import { ImageFilterChips } from './ImageFilterChips'
import { ImageRunCards } from './ImageRunCards'
import { useImageTracking } from './image-tracking'
import { ImagePager, ImageSearchRow, ImageTableState, imageRowStyles } from './image-view-parts'
import { SettleFailedChip } from './SettleFailedChip'
import {
  IMAGE_PAGE_SIZE,
  toggled,
  useImagePage,
  useImageSort,
  useImageTableFollows
} from './use-image-query'

const PRODUCTS = ['dc', 'sa', 'ap', 'storage', 'cp', 'other'] as const
const DISTS = ['rhel', 'redos'] as const
// In progress first: the quick filter for what is building now.
const STATUS_FILTERS = ['running', 'failed'] as const
const SORTS: { value: BuildWebImageSort; label: string }[] = [
  { value: 'image', label: 'Image' },
  { value: 'product', label: 'Product' },
  { value: 'version', label: 'Version' },
  { value: 'dist', label: 'dist' },
  { value: 'at', label: 'Last build' },
  { value: 'status', label: 'Status' },
  { value: 'registry', label: 'Registry' }
]

const productName = (p: string) =>
  p === 'other'
    ? 'Other'
    : p === 'storage'
      ? 'Storage'
      : p === 'cp'
        ? 'Chat Platform'
        : p.toUpperCase()

// Why the dist too: an image building for redos and rhel at once is a row each.
const rowKeyOf = (row: BuildWebImageRow) => `${row.image}|${row.last?.dist ?? ''}`

/** build-web's Images: the newest build of every image, with its filters, picks and actions. */
export function ImageListView({
  active,
  reloadToken,
  onOpenImage,
  onBuild,
  onOpenLog
}: {
  active: boolean
  reloadToken: number
  onOpenImage: (image: string) => void
  onBuild: (choice: ImageBuildChoice) => void
  onOpenLog: OpenImageLog
}) {
  const { status } = useBuildWebScreen()
  const tracking = useImageTracking()
  const [q, setQ] = useState('')
  const [filters, setFilters] = useState<ImageFilters>(NO_IMAGE_FILTERS)
  const { products, dists, version } = filters
  const statuses = STATUS_FILTERS.filter((st) => filters.statuses.includes(st))
  const [page, setPage] = useState(0)
  const narrowFilters = (patch: Partial<ImageFilters>) => {
    setFilters((current) => ({ ...current, ...patch }))
    setPage(0)
  }
  const picks = useImagePicks()
  const sorting = useImageSort(() => setPage(0))
  const { data, loading, error, reload } = useImagePage(
    {
      sort: sorting.sort ?? undefined,
      dir: sorting.dir,
      q,
      products,
      dists,
      statuses,
      version: version === 'all' ? undefined : version,
      page,
      pageSize: IMAGE_PAGE_SIZE
    },
    reloadToken
  )
  const rows = data?.rows ?? []
  // Why the token: Refresh asks the freshness scans past the host's two-minute copy too.
  const fresh = useImageFreshness(rows, version === 'all' ? null : version, reloadToken)
  const canBuild = status.perms.includes('build')
  useImageTableFollows(reload, {
    running: rows.some((r) => r.last?.status === 'running'),
    pushing: pushesGoing(tracking.pushes).ids.length > 0,
    pushSettles: tracking.pushSettles,
    active
  })

  const narrowed = Boolean(
    q.trim() || products.length || dists.length || statuses.length || version !== 'all'
  )
  const reset = () => {
    setQ('')
    narrowFilters(NO_IMAGE_FILTERS)
  }

  const renderRow = ({ item: row }: { item: BuildWebImageRow }) => {
    const rowKey = rowKeyOf(row)
    const last = row.last
    const picked = picks.has(rowKey)
    return (
      <View style={[imageRowStyles.row, picked ? imageRowStyles.picked : null]}>
        <View style={imageRowStyles.tick}>
          {/* Why no disabled box: a faded one reads the same as an empty one. */}
          {last && imageRefOf(last) ? (
            <BuildTabTick
              checked={picked}
              onPress={() => picks.toggle(rowKey, last)}
              accessibilityLabel={`Pick ${row.image}`}
            />
          ) : null}
        </View>
        <View style={imageRowStyles.body}>
          <View style={imageRowStyles.top}>
            <Pressable
              style={styles.nameButton}
              accessibilityRole="button"
              accessibilityLabel={`Open ${row.image}`}
              onPress={() => onOpenImage(row.image)}
            >
              <Text style={imageRowStyles.name} numberOfLines={2}>
                {row.image}
              </Text>
            </Pressable>
            {last && row.lastSuccess && canBuild ? (
              <SettleFailedChip
                failed={last}
                success={row.lastSuccess}
                onSettled={() => reload(true)}
              />
            ) : last ? (
              <BuildStatusChip build={last} />
            ) : null}
          </View>
          <View style={imageRowStyles.facts}>
            <BuildWebToneChip label={productName(row.product)} tone={productTone(row.product)} />
            {last?.version ? <BuildWebToneChip label={last.version} tone={null} mono /> : null}
            {last ? <Text style={imageRowStyles.meta}>{last.dist}</Text> : null}
            {last?.at ? <Text style={imageRowStyles.meta}>{formatBuildTime(last.at)}</Text> : null}
            {fresh.shown ? <FreshnessChip row={row} scan={fresh.of(row)} /> : null}
            {last ? <LogLink build={last} onOpen={onOpenLog} /> : null}
            {last ? <RowRegistryChip rowKey={rowKey} build={last} /> : null}
            {canBuild ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Build ${row.image}`}
                hitSlop={8}
                onPress={() =>
                  onBuild({
                    images: [row.image],
                    product: row.product,
                    branch: last?.branch || undefined
                  })
                }
              >
                <Hammer size={15} color={colors.textSecondary} />
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <ImageSearchRow
        value={q}
        placeholder="Search by image or tag"
        onChange={(next) => {
          setQ(next)
          setPage(0)
        }}
        sorting={sorting}
        sorts={SORTS}
      />
      <View style={styles.filters}>
        <ImageFilterChips
          options={PRODUCTS}
          counts={data?.counts.products ?? {}}
          selected={products}
          label={productName}
          onToggle={(p) => {
            const next = toggled(products, p)
            // Why: versions belong to the picked products; none picked, no version filter.
            narrowFilters(next.length ? { products: next } : { products: next, version: 'all' })
          }}
        />
        <ImageFilterChips
          options={DISTS}
          counts={data?.counts.dists ?? {}}
          selected={dists}
          label={(d) => d}
          onToggle={(d) => narrowFilters({ dists: toggled(dists, d) })}
        />
        <View style={styles.statusRow}>
          <View style={styles.grow}>
            <ImageFilterChips
              options={STATUS_FILTERS}
              counts={data?.counts.statuses ?? {}}
              selected={statuses}
              label={buildStatusLabel}
              onToggle={(st) => narrowFilters({ statuses: toggled(statuses, st) })}
            />
          </View>
          {narrowed ? (
            <View style={styles.reset}>
              <FilterPill icon={FilterX} label="Reset" onPress={reset} />
            </View>
          ) : null}
        </View>
        {products.length ? (
          <ImageFilterChips
            options={data?.versions ?? []}
            selected={version === 'all' ? [] : [version]}
            label={(v) => v}
            onToggle={(v) => narrowFilters({ version: v === version ? 'all' : v })}
          />
        ) : null}
      </View>
      <ImageActionBar
        picks={picks}
        canBuild={canBuild}
        onBuild={onBuild}
        onPushed={() => reload(true)}
      />
      <ImageRunCards active={active} onSettled={() => reload(true)} onOpenLog={onOpenLog} />
      <ImageTableState
        error={error}
        loading={loading}
        empty={rows.length === 0}
        emptyText={narrowed ? 'Nothing matches these filters.' : 'No images.'}
        onRetry={() => reload(true)}
      />
      {rows.length ? (
        <FlatList
          style={styles.grow}
          data={rows}
          keyExtractor={rowKeyOf}
          renderItem={renderRow}
          keyboardShouldPersistTaps="handled"
        />
      ) : null}
      <ImagePager
        total={data?.total ?? 0}
        of={data?.of ?? 0}
        page={page}
        loading={loading}
        onPageChange={setPage}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
  grow: { flex: 1, minHeight: 0 },
  filters: { gap: spacing.xs + 2, paddingVertical: spacing.sm },
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  reset: { paddingRight: spacing.md },
  nameButton: { flex: 1, minWidth: 0 }
})
