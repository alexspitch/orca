import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { ChevronLeft, ChevronRight } from 'lucide-react-native'
import {
  BUILD_WEB_STATUSES,
  BUILD_WEB_SUBTASK_STATUSES,
  type BuildWebIssueRow
} from '../../../../src/shared/build-web-types'
import type { BuildWebSavedQuery } from '../../../../src/shared/build-web-saved-query-types'
import { LoadingSpinner } from '../../components/LoadingSpinner'
import { MobileLoadErrorState } from '../../components/MobileLoadErrorState'
import { PickerModal } from '../../components/PickerModal'
import { colors, spacing, typography } from '../../theme/mobile-theme'
import { BUILD_WEB_PRIORITIES, loginOf, priorityLabel, statusLabel } from '../build-web-labels'
import { useBuildWebScreen } from '../build-web-screen-context'
import { familiesOf, foldedOf, headCount, isUnder, visibleIssues } from './issue-families'
import { ISSUE_PAGE_SIZE } from './issue-list-query'
import { IssueListFilters } from './IssueListFilters'
import { IssueListRow, type IssueRowField } from './IssueListRow'
import { IssueListTabs } from './IssueListTabs'
import { IssueSelectionBar } from './IssueSelectionBar'
import { SavedQueriesSheet } from './SavedQueriesSheet'
import { SaveQuerySheet } from './SaveQuerySheet'
import { useBuildWebAssignees } from './use-build-web-assignees'
import { useIssueList } from './use-issue-list'
import { useIssueRowActions } from './use-issue-row-actions'
import { useOpenBuildWebSession } from './use-open-build-web-session'
import { useQueryTabs } from './use-query-tabs'
import { useRecentTasks } from './use-recent-tasks'
import { useTakeToWork } from '../take-to-work/use-take-to-work'

const NOBODY = '__nobody__'

type Picking = { issue: BuildWebIssueRow; field: IssueRowField } | null

/** The Issues list: the desktop page's tabs, filters, table, pager and selection bar. */
export function BuildWebIssueListView({
  reloadToken,
  visible
}: {
  reloadToken: number
  visible: boolean
}) {
  const screen = useBuildWebScreen()
  const consoleUrl = screen.status.baseUrl ?? ''
  const list = useIssueList(reloadToken)
  const queryTabs = useQueryTabs(screen.hostId, consoleUrl, list)
  const recent = useRecentTasks(screen.hostId, consoleUrl)
  const rows = useIssueRowActions(list)
  const session = useOpenBuildWebSession()
  const takeToWork = useTakeToWork()
  const users = useBuildWebAssignees(list.issues.length > 0)
  const [savedOpen, setSavedOpen] = useState(false)
  const [saving, setSaving] = useState<readonly BuildWebSavedQuery[] | null>(null)
  const [picking, setPicking] = useState<Picking>(null)
  const listRef = useRef<FlatList<BuildWebIssueRow>>(null)
  const scrollOffset = useRef(0)

  // Why: a list hidden under a card loses its scroll on web, so it is put back on Back.
  useEffect(() => {
    if (!visible || scrollOffset.current === 0) {
      return
    }
    const frame = requestAnimationFrame(() =>
      listRef.current?.scrollToOffset({ offset: scrollOffset.current, animated: false })
    )
    return () => cancelAnimationFrame(frame)
  }, [visible])

  const { registerList } = screen
  const { patchIssue, dropIssue, reload } = list
  useEffect(() => {
    registerList({ patch: patchIssue, drop: dropIssue, reload })
  }, [dropIssue, patchIssue, registerList, reload])

  const kids = useMemo(() => familiesOf(list.issues), [list.issues])
  const folded = useMemo(
    () => foldedOf(list.foldAll, list.toggled, kids),
    [kids, list.foldAll, list.toggled]
  )
  const shown = useMemo(() => visibleIssues(list.issues, kids, folded), [folded, kids, list.issues])
  const picked = list.issues.filter((issue) => list.selected.has(issue.id))
  const selecting = picked.length > 0

  const { openIssue } = screen
  const { keep } = recent
  const open = useCallback(
    (issue: BuildWebIssueRow) => {
      keep(issue.id, issue)
      openIssue(issue.id)
    },
    [keep, openIssue]
  )
  const { toggleSelected, toggleFamily } = list
  const select = useCallback(
    (issue: BuildWebIssueRow) => toggleSelected(issue.id),
    [toggleSelected]
  )
  const toggleOne = useCallback((issue: BuildWebIssueRow) => toggleFamily(issue.id), [toggleFamily])
  const { toggleFavorite, patch } = rows
  const favorite = useCallback(
    (issue: BuildWebIssueRow) => void toggleFavorite(issue),
    [toggleFavorite]
  )
  const pick = useCallback(
    (issue: BuildWebIssueRow, field: IssueRowField) => setPicking({ issue, field }),
    []
  )
  const { open: openSession } = session
  const openRowSession = useCallback(
    (issue: BuildWebIssueRow) => {
      void openSession(issue)
    },
    [openSession]
  )

  const pages = Math.ceil(list.total / ISSUE_PAGE_SIZE)
  const from = list.page * ISSUE_PAGE_SIZE + 1
  const to = list.page * ISSUE_PAGE_SIZE + headCount(list.issues, kids)

  const body = () => {
    // A failed re-read keeps the rows it already shows, with the failure above them.
    if (list.error && list.issues.length === 0) {
      return <MobileLoadErrorState message={list.error} onRetry={list.reload} />
    }
    if (list.issues.length === 0) {
      return (
        <View style={styles.state}>
          {list.loading ? (
            <LoadingSpinner size={18} color={colors.textMuted} />
          ) : (
            <Text style={styles.muted}>No tasks match these filters.</Text>
          )}
        </View>
      )
    }
    return (
      <>
        {list.error ? <Text style={styles.error}>{list.error}</Text> : null}
        <FlatList
          ref={listRef}
          onScroll={(event) => {
            if (visible) {
              scrollOffset.current = event.nativeEvent.contentOffset.y
            }
          }}
          scrollEventThrottle={100}
          data={shown}
          keyExtractor={(issue) => issue.id}
          renderItem={({ item }) => (
            <IssueListRow
              issue={item}
              family={{
                count: kids.get(item.id) ?? 0,
                under: isUnder(item, kids),
                open: !folded.has(item.id)
              }}
              selecting={selecting}
              selected={list.selected.has(item.id)}
              busy={rows.busy.has(item.id)}
              onOpen={open}
              onSelect={select}
              onToggleFamily={toggleOne}
              onFavorite={favorite}
              onPick={pick}
              onOpenSession={openRowSession}
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={list.loading}
              onRefresh={list.reload}
              tintColor={colors.textMuted}
            />
          }
          keyboardShouldPersistTaps="handled"
          ListFooterComponent={
            pages > 1 ? (
              <View style={styles.pager}>
                <Text style={styles.muted}>
                  {from}–{to} of {list.total}
                </Text>
                <View style={styles.grow} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Previous page"
                  disabled={list.page === 0 || list.loading}
                  onPress={() => list.setPage(list.page - 1)}
                  style={[styles.pageButton, list.page === 0 ? styles.disabled : null]}
                >
                  <ChevronLeft size={18} color={colors.textPrimary} />
                </Pressable>
                <Text style={styles.muted}>
                  {list.page + 1} / {pages}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Next page"
                  disabled={list.page >= pages - 1 || list.loading}
                  onPress={() => list.setPage(list.page + 1)}
                  style={[styles.pageButton, list.page >= pages - 1 ? styles.disabled : null]}
                >
                  <ChevronRight size={18} color={colors.textPrimary} />
                </Pressable>
              </View>
            ) : null
          }
        />
      </>
    )
  }

  const issue = picking?.issue ?? null
  const pickerOptions = () => {
    if (!issue) {
      return []
    }
    switch (picking?.field) {
      case 'status':
        return (issue.parent_id ? BUILD_WEB_SUBTASK_STATUSES : BUILD_WEB_STATUSES).map((s) => ({
          value: s,
          label: statusLabel(s),
          disabled: s === issue.status
        }))
      case 'priority':
        return BUILD_WEB_PRIORITIES.map((p) => ({
          value: String(p),
          label: priorityLabel(p),
          disabled: p === issue.priority
        }))
      case 'assignee':
      case undefined:
        return [
          { value: NOBODY, label: 'Nobody' },
          ...users.map((user) => ({
            value: user.email,
            label: loginOf(user.email),
            subtitle: user.name || undefined
          }))
        ]
    }
  }
  const pickerSelected = !issue
    ? ''
    : picking?.field === 'status'
      ? issue.status
      : picking?.field === 'priority'
        ? String(issue.priority)
        : issue.assignee || NOBODY
  const applyPick = (value: string) => {
    setPicking(null)
    if (!issue || value === pickerSelected) {
      return
    }
    switch (picking?.field) {
      case 'status': {
        const status = BUILD_WEB_STATUSES.find((s) => s === value)
        if (status) {
          void patch(issue, { status })
        }
        return
      }
      case 'priority':
        void patch(issue, { priority: Number(value) })
        return
      case 'assignee':
      case undefined:
        void patch(issue, { assignee: value === NOBODY ? '' : value })
    }
  }

  return (
    <View style={styles.root}>
      <IssueListTabs
        queryTabId={list.queryTabId}
        queryTabs={queryTabs}
        recent={recent}
        onOpenTask={(id) => {
          keep(id, null)
          openIssue(id)
        }}
      />
      <IssueListFilters list={list} onOpenSavedQueries={() => setSavedOpen(true)} />
      <View style={styles.grow}>{body()}</View>
      <IssueSelectionBar picked={picked} onClear={list.clearSelection} onTakeToWork={takeToWork} />
      <SavedQueriesSheet
        visible={savedOpen}
        tabs={queryTabs}
        onSaveCurrent={setSaving}
        onClose={() => setSavedOpen(false)}
      />
      <SaveQuerySheet known={saving} list={list} onClose={() => setSaving(null)} />
      <PickerModal
        visible={picking !== null}
        title={
          picking?.field === 'status'
            ? `Status of ${issue?.key ?? ''}`
            : picking?.field === 'priority'
              ? `Priority of ${issue?.key ?? ''}`
              : `Assignee of ${issue?.key ?? ''}`
        }
        options={pickerOptions()}
        selected={pickerSelected}
        onSelect={applyPick}
        onClose={() => setPicking(null)}
      />
      {rows.confirmElement}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
  grow: { flex: 1, minHeight: 0 },
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
    paddingVertical: spacing.md
  },
  pageButton: { padding: spacing.xs },
  disabled: { opacity: 0.35 }
})
