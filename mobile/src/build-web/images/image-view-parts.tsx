import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { ArrowDownUp, ChevronLeft, ChevronRight } from 'lucide-react-native'
import type { BuildWebImageSort } from '../../../../src/shared/build-web-image-types'
import { LoadingSpinner } from '../../components/LoadingSpinner'
import { MobileLoadErrorState } from '../../components/MobileLoadErrorState'
import { MobileSearchField } from '../../components/MobileSearchField'
import { PickerModal } from '../../components/PickerModal'
import { colors, spacing, typography } from '../../theme/mobile-theme'
import { FilterPill } from '../list/list-controls'
import { IMAGE_PAGE_SIZE, type ImageSorting } from './use-image-query'

// Pieces the image list and one image's history share: search and sort, count, states, pages.

const UNSORTED = '__unsorted__'

export function ImageSearchRow({
  value,
  placeholder,
  onChange,
  sorting,
  sorts
}: {
  value: string
  placeholder: string
  onChange: (value: string) => void
  sorting: ImageSorting
  /** The table's sortable columns, named as its headers are. */
  sorts: readonly { value: BuildWebImageSort; label: string }[]
}) {
  const [open, setOpen] = useState(false)
  const current = sorts.find((s) => s.value === sorting.sort)
  return (
    <View style={styles.searchRow}>
      <View style={styles.grow}>
        <MobileSearchField
          value={value}
          onChangeText={onChange}
          onClear={() => onChange('')}
          placeholder={placeholder}
          accessibilityLabel={placeholder}
        />
      </View>
      <FilterPill
        icon={ArrowDownUp}
        label={current ? `${current.label} ${sorting.dir === 'asc' ? '↑' : '↓'}` : 'Sort'}
        pressed={Boolean(current)}
        onPress={() => setOpen(true)}
        accessibilityLabel="Sort"
      />
      <PickerModal
        visible={open}
        title="Sort by"
        subtitle="The same column again turns the order around."
        options={sorts.map((s) => ({
          value: s.value,
          label:
            s.value === sorting.sort ? `${s.label} ${sorting.dir === 'asc' ? '↑' : '↓'}` : s.label
        }))}
        selected={sorting.sort ?? UNSORTED}
        onSelect={(next) => {
          const sort = sorts.find((s) => s.value === next)
          if (sort) {
            sorting.onSort(sort.value)
          }
        }}
        onClose={() => setOpen(false)}
      />
    </View>
  )
}

/** Error, loading or empty in place of the rows; null when there are rows to show. */
export function ImageTableState({
  error,
  loading,
  empty,
  emptyText,
  onRetry
}: {
  error: string | null
  loading: boolean
  empty: boolean
  emptyText: string
  onRetry: () => void
}) {
  if (!empty) {
    return error ? <Text style={styles.error}>{error}</Text> : null
  }
  if (error) {
    return <MobileLoadErrorState message={error} onRetry={onRetry} />
  }
  return (
    <View style={styles.state}>
      {loading ? (
        <LoadingSpinner size={18} color={colors.textMuted} />
      ) : (
        <Text style={styles.muted}>{emptyText}</Text>
      )}
    </View>
  )
}

export function ImagePager({
  total,
  of,
  page,
  loading,
  pageSize = IMAGE_PAGE_SIZE,
  onPageChange
}: {
  total: number
  of: number
  page: number
  loading: boolean
  pageSize?: number
  onPageChange: (page: number) => void
}) {
  const pages = Math.ceil(total / pageSize)
  return (
    <View style={styles.pager}>
      <Text style={styles.muted}>
        {total} of {of}
      </Text>
      <View style={styles.grow} />
      {pages > 1 ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous page"
            disabled={page === 0 || loading}
            onPress={() => onPageChange(page - 1)}
            style={[styles.pageButton, page === 0 ? styles.disabled : null]}
          >
            <ChevronLeft size={18} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.muted}>
            {page + 1} / {pages}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next page"
            disabled={page >= pages - 1 || loading}
            onPress={() => onPageChange(page + 1)}
            style={[styles.pageButton, page >= pages - 1 ? styles.disabled : null]}
          >
            <ChevronRight size={18} color={colors.textPrimary} />
          </Pressable>
        </>
      ) : null}
    </View>
  )
}

export const imageRowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle
  },
  picked: { backgroundColor: colors.bgRaised },
  tick: { width: 20, paddingTop: 2 },
  body: { flex: 1, minWidth: 0, gap: spacing.xs + 2 },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  facts: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  name: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: typography.monoFamily,
    fontSize: typography.metaSize + 1
  },
  meta: { color: colors.textMuted, fontSize: typography.metaSize }
})

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm
  },
  grow: { flex: 1, minWidth: 0 },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  muted: { color: colors.textMuted, fontSize: typography.metaSize },
  error: {
    color: colors.statusRed,
    fontSize: typography.metaSize,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs
  },
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle
  },
  pageButton: { padding: spacing.xs },
  disabled: { opacity: 0.45 }
})
