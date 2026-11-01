import { useEffect, useMemo, useState } from 'react'
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native'
import { Bot, FilterX, Package, Tag } from 'lucide-react-native'
import type { BuildWebRecap, BuildWebRecapPage } from '../../../../src/shared/build-web-recap-types'
import { BUILD_WEB_RECAPS_RUNTIME_CAPABILITY } from '../../../../src/shared/build-web-capability'
import {
  NO_RECAP_FILTERS,
  hasRecapFilters,
  recapAutomationOptions,
  recapQuery,
  recapVersionOptions,
  withRecapProduct,
  withRecapVersion,
  type RecapFilters
} from '../../../../src/renderer/src/components/build-web/recaps/recap-filters'
import { recapWindowLabel } from '../../../../src/renderer/src/components/build-web/recaps/recap-window'
import { PickerModal } from '../../components/PickerModal'
import { colors, spacing, typography } from '../../theme/mobile-theme'
import { buildWebErrorMessage } from '../build-web-operations'
import { productLabel } from '../build-web-labels'
import { useBuildWebScreen } from '../build-web-screen-context'
import { ProductChip } from '../BuildWebToneChip'
import { ImagePager, ImageTableState, imageRowStyles } from '../images/image-view-parts'
import { FilterPill } from '../list/list-controls'
import { recapDays, recapTime } from './recap-days'
import { RecapReportView } from './RecapReportView'

const PAGE_SIZE = 25
const ALL = 'all'

function startedBy(recap: BuildWebRecap): string {
  if (recap.trigger === 'scheduled') {
    return 'scheduled'
  }
  return recap.started_by?.split('@')[0] || 'by hand'
}

/**
 * The desktop's Recaps as a list: build-web's finished automation reports, newest first under the
 * day each stands at, by product, version and automation. A report opens over the list, which
 * keeps its page.
 */
export function BuildWebRecapsView({
  active,
  reloadToken,
  recap,
  onOpenRecap,
  onOpenIssue
}: {
  active: boolean
  reloadToken: number
  recap: BuildWebRecap | null
  onOpenRecap: (recap: BuildWebRecap) => void
  onOpenIssue: (issueId: string) => void
}) {
  const { call, hostCapabilities } = useBuildWebScreen()
  const supported = hostCapabilities.includes(BUILD_WEB_RECAPS_RUNTIME_CAPABILITY)
  const [filters, setFilters] = useState<RecapFilters>(NO_RECAP_FILTERS)
  const [page, setPage] = useState(0)
  const [data, setData] = useState<BuildWebRecapPage | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const [picking, setPicking] = useState<'product' | 'version' | 'automation' | null>(null)
  const narrow = (next: RecapFilters) => {
    setFilters(next)
    setPage(0)
  }
  const [today] = useState(() => new Date())
  const days = useMemo(() => recapDays(data?.results ?? [], today), [data, today])
  const args = recapQuery(filters, page, PAGE_SIZE)
  const key = JSON.stringify(args)
  useEffect(() => {
    if (!active || !supported) {
      return
    }
    let alive = true
    setLoading(true)
    call('recaps', args)
      .then((result) => {
        if (!alive) {
          return
        }
        if (!result.ok) {
          setError(result.error)
          return
        }
        const { results, total } = result.value
        // A re-read that shrank the list past this page goes to its last page instead.
        if (results.length === 0 && page > 0 && total > 0) {
          setPage(Math.ceil(total / PAGE_SIZE) - 1)
          return
        }
        setData(result.value)
        setError(null)
      })
      .catch((failure: unknown) => alive && setError(buildWebErrorMessage(failure)))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [active, call, key, reload, reloadToken, supported])

  if (!supported) {
    return (
      <Text style={styles.note}>
        This Orca server does not show Recaps on the phone yet. Update the server.
      </Text>
    )
  }
  const facets = data?.facets ?? null
  const versions = facets ? recapVersionOptions(facets.versions, filters.product, productLabel) : []
  const automations = facets?.automations ? recapAutomationOptions(facets.automations, filters) : []

  const row = ({ item }: { item: BuildWebRecap }) => {
    const windowLabel = recapWindowLabel(item)
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => onOpenRecap(item)}
        style={({ pressed }) => [imageRowStyles.row, pressed ? styles.pressed : null]}
      >
        <View style={imageRowStyles.body}>
          <View style={imageRowStyles.top}>
            <Text style={styles.title} numberOfLines={2}>
              {item.name}
            </Text>
            <Text style={styles.meta}>{recapTime(item)}</Text>
          </View>
          <View style={imageRowStyles.facts}>
            <ProductChip product={item.product} />
            <Text style={styles.meta} numberOfLines={1}>
              {[
                item.version?.name,
                item.commit?.slice(0, 8),
                windowLabel ? `window ${windowLabel}` : '',
                startedBy(item)
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>
        </View>
      </Pressable>
    )
  }

  return (
    <View style={styles.root}>
      <View style={[styles.root, recap ? styles.hidden : null]}>
        <View style={styles.pills}>
          <FilterPill
            icon={Package}
            label={filters.product === ALL ? 'All products' : productLabel(filters.product)}
            pressed={filters.product !== ALL}
            disabled={!facets}
            onPress={() => setPicking('product')}
          />
          <FilterPill
            icon={Tag}
            label={versions.find((v) => v.value === filters.versionId)?.label ?? 'All versions'}
            pressed={filters.versionId !== ALL}
            disabled={!facets}
            onPress={() => setPicking('version')}
          />
          {/* A console that cannot narrow to one automation sends none. */}
          {facets?.automations ? (
            <FilterPill
              icon={Bot}
              label={
                automations.find((a) => a.id === filters.automationId)?.name ?? 'All automations'
              }
              pressed={filters.automationId !== ALL}
              onPress={() => setPicking('automation')}
            />
          ) : null}
          {hasRecapFilters(filters) ? (
            <FilterPill icon={FilterX} label="Reset" onPress={() => narrow(NO_RECAP_FILTERS)} />
          ) : null}
        </View>
        {/* Why here: the empty state shows an error only while there are no rows to keep. */}
        {error && days.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry loading the reports"
            onPress={() => setReload((n) => n + 1)}
            style={styles.errorRow}
          >
            <Text style={styles.error} numberOfLines={2}>
              {error}
            </Text>
            <Text style={styles.retry}>Retry</Text>
          </Pressable>
        ) : null}
        <SectionList
          sections={days}
          keyExtractor={(item) => item.id}
          renderItem={row}
          renderSectionHeader={({ section }) => (
            <View style={styles.day}>
              <Text style={styles.dayLabel} numberOfLines={1}>
                {section.label}
              </Text>
              <Text style={styles.meta}>{section.data.length}</Text>
            </View>
          )}
          stickySectionHeadersEnabled={false}
          style={styles.grow}
          ListEmptyComponent={
            <ImageTableState
              error={error}
              loading={loading || data === null}
              empty
              emptyText={
                hasRecapFilters(filters)
                  ? 'No reports match these filters.'
                  : 'No automation reports yet. They appear here when an automation in build-web finishes.'
              }
              onRetry={() => setReload((n) => n + 1)}
            />
          }
        />
        <ImagePager
          total={data?.total ?? 0}
          of={data?.total ?? 0}
          page={page}
          loading={loading}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      </View>
      {recap ? <RecapReportView recap={recap} onOpenIssue={onOpenIssue} /> : null}
      <PickerModal
        visible={picking === 'product'}
        title="Product"
        options={[
          { value: ALL, label: 'All products' },
          ...(facets?.products ?? []).map((p) => ({ value: p, label: productLabel(p) }))
        ]}
        selected={filters.product}
        onSelect={(product) => facets && narrow(withRecapProduct(filters, product, facets))}
        onClose={() => setPicking(null)}
      />
      <PickerModal
        visible={picking === 'version'}
        title="Version"
        options={[{ value: ALL, label: 'All versions' }, ...versions]}
        selected={filters.versionId}
        onSelect={(versionId) => facets && narrow(withRecapVersion(filters, versionId, facets))}
        onClose={() => setPicking(null)}
      />
      <PickerModal
        visible={picking === 'automation'}
        title="Automation"
        options={[
          { value: ALL, label: 'All automations' },
          ...automations.map((a) => ({ value: a.id, label: a.name }))
        ]}
        selected={filters.automationId}
        onSelect={(automationId) => narrow({ ...filters, automationId })}
        onClose={() => setPicking(null)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
  hidden: { display: 'none' },
  grow: { flex: 1, minWidth: 0 },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  day: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle
  },
  dayLabel: {
    color: colors.textSecondary,
    fontSize: typography.metaSize,
    fontWeight: '600',
    textTransform: 'uppercase'
  },
  title: { flex: 1, color: colors.textPrimary, fontSize: typography.bodySize },
  meta: { flexShrink: 1, color: colors.textMuted, fontSize: typography.metaSize },
  pressed: { backgroundColor: colors.bgRaised },
  note: { color: colors.textSecondary, padding: spacing.md },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm
  },
  error: { flex: 1, color: colors.statusRed, fontSize: typography.metaSize },
  retry: { color: colors.textPrimary, fontSize: typography.metaSize, fontWeight: '600' }
})
