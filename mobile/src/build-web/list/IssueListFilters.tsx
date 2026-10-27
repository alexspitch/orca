import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import {
  Archive,
  ArrowDown,
  ArrowUp,
  Bookmark,
  Bot,
  ChevronDown,
  FoldVertical,
  ListTodo,
  Star,
  Ticket,
  UnfoldVertical,
  User,
  type LucideIcon
} from 'lucide-react-native'
import {
  BUILD_WEB_ISSUE_SORTS,
  BUILD_WEB_PRODUCTS,
  type BuildWebIssueSort,
  type BuildWebProduct
} from '../../../../src/shared/build-web-types'
import {
  QUICK_FILTERS,
  type QuickFilter
} from '../../../../src/renderer/src/components/build-web/build-web-view-prefs'
import { MobileSearchField } from '../../components/MobileSearchField'
import { PickerModal } from '../../components/PickerModal'
import { colors, spacing } from '../../theme/mobile-theme'
import { productLabel, quickFilterLabel } from '../build-web-labels'
import { familiesOf, foldedOf } from './issue-families'
import { OPEN_STATUSES, sameStatuses, TO_WORK_STATUSES } from './issue-list-query'
import { FilterPill } from './list-controls'
import { IssueStatusSheet, statusSummaryOf } from './IssueStatusSheet'
import type { IssueList } from './use-issue-list'

const QUICK_ICON: Record<QuickFilter, LucideIcon> = {
  mine: User,
  ai: Bot,
  favorite: Star,
  jira: Ticket,
  archived: Archive
}

const SORT_LABELS: Record<BuildWebIssueSort, string> = {
  key: 'Key',
  title: 'Title',
  priority: 'Priority',
  type: 'Type',
  status: 'Status',
  updated_at: 'Updated',
  favorite: 'Favorites first'
}

type Sheet = 'status' | 'product' | 'sort' | null

/** The desktop's filter bar: quick filters, «To work», status, product, sort, folds and search. */
export function IssueListFilters({
  list,
  onOpenSavedQueries
}: {
  list: IssueList
  onOpenSavedQueries: () => void
}) {
  const [sheet, setSheet] = useState<Sheet>(null)
  const kids = familiesOf(list.issues)
  const folded = foldedOf(list.foldAll, list.toggled, kids)
  const allFolded = kids.size > 0 && [...kids.keys()].every((id) => folded.has(id))
  const toWork = sameStatuses(list.statuses, TO_WORK_STATUSES)
  const SortIcon = list.sort.dir === 'asc' ? ArrowUp : ArrowDown

  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        keyboardShouldPersistTaps="handled"
      >
        <FilterPill
          label="Saved"
          icon={Bookmark}
          onPress={onOpenSavedQueries}
          accessibilityLabel="Saved queries"
        />
        {QUICK_FILTERS.map((q) => (
          <FilterPill
            key={q}
            label={quickFilterLabel(q)}
            icon={QUICK_ICON[q]}
            pressed={list.quick.has(q)}
            onPress={() => list.toggleQuick(q)}
          />
        ))}
        <FilterPill
          label="To work"
          icon={ListTodo}
          pressed={toWork}
          onPress={() => list.setStatuses(toWork ? OPEN_STATUSES : TO_WORK_STATUSES)}
        />
        <FilterPill
          label={statusSummaryOf(list.statuses)}
          accessibilityLabel="Status"
          trailing={<ChevronDown size={12} color={colors.textMuted} />}
          onPress={() => setSheet('status')}
        />
        <FilterPill
          label={list.product === 'all' ? 'All products' : productLabel(list.product)}
          accessibilityLabel="Product"
          trailing={<ChevronDown size={12} color={colors.textMuted} />}
          onPress={() => setSheet('product')}
        />
        <FilterPill
          label={SORT_LABELS[list.sort.sort]}
          icon={SortIcon}
          accessibilityLabel="Sort"
          onPress={() => setSheet('sort')}
        />
        <FilterPill
          label={allFolded ? 'Show subtasks' : 'Hide subtasks'}
          icon={allFolded ? UnfoldVertical : FoldVertical}
          disabled={kids.size === 0}
          onPress={() => list.setFoldAll(!allFolded)}
        />
      </ScrollView>
      <View style={styles.search}>
        <MobileSearchField
          value={list.query}
          onChangeText={list.setQuery}
          onClear={() => list.setQuery('')}
          placeholder="Search by key or title"
          accessibilityLabel="Search by key or title"
        />
      </View>
      <IssueStatusSheet
        visible={sheet === 'status'}
        statuses={list.statuses}
        onToggle={list.toggleStatus}
        onSet={list.setStatuses}
        onClose={() => setSheet(null)}
      />
      <PickerModal<BuildWebProduct | 'all'>
        visible={sheet === 'product'}
        title="Product"
        options={[
          { value: 'all', label: 'All products' },
          ...BUILD_WEB_PRODUCTS.map((p) => ({ value: p, label: productLabel(p) }))
        ]}
        selected={list.product}
        onSelect={(next) => {
          setSheet(null)
          list.setProduct(next)
        }}
        onClose={() => setSheet(null)}
      />
      <PickerModal<BuildWebIssueSort>
        visible={sheet === 'sort'}
        title="Sort"
        subtitle="The same column again flips the direction."
        options={BUILD_WEB_ISSUE_SORTS.map((s) => ({
          value: s,
          label: SORT_LABELS[s],
          subtitle:
            s === list.sort.sort
              ? list.sort.dir === 'asc'
                ? 'Ascending'
                : 'Descending'
              : undefined
        }))}
        selected={list.sort.sort}
        onSelect={(next) => {
          setSheet(null)
          list.sortBy(next)
        }}
        onClose={() => setSheet(null)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    paddingBottom: spacing.sm,
    gap: spacing.sm
  },
  row: { gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  search: { paddingHorizontal: spacing.md }
})
