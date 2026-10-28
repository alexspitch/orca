import { useEffect, useState } from 'react'
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { CalendarDays, FileText, FilterX, User } from 'lucide-react-native'
import {
  BUILD_WEB_TASK_KINDS,
  BUILD_WEB_TASK_STATES,
  type BuildWebConsoleTask,
  type BuildWebTaskPage
} from '../../../../src/shared/build-web-activity-types'
import { BUILD_WEB_TASK_PAGE_RUNTIME_CAPABILITY } from '../../../../src/shared/build-web-capability'
import {
  BUILD_WEB_TASK_STATE_LABELS,
  taskKindLabel
} from '../../../../src/shared/build-web-task-labels'
import {
  hasTaskFilters,
  NO_TASK_FILTERS,
  taskPageArgs,
  type BuildWebTaskFilters
} from '../../../../src/shared/build-web-task-page'
import {
  buildPageUrl,
  taskTone
} from '../../../../src/renderer/src/components/build-web/activity/activity-targets'
import { toggled } from '../images/use-image-query'
import { MobileSearchField } from '../../components/MobileSearchField'
import { PickerModal } from '../../components/PickerModal'
import { colors, spacing, typography } from '../../theme/mobile-theme'
import { buildWebErrorMessage } from '../build-web-operations'
import { useBuildWebScreen } from '../build-web-screen-context'
import { BuildWebToneChip } from '../BuildWebToneChip'
import { BuildLogSheet } from '../issue/tabs/build/BuildLogSheet'
import { FilterPill } from '../list/list-controls'
import { ImageFilterChips } from '../images/ImageFilterChips'
import { ImagePager, ImageTableState, imageRowStyles } from '../images/image-view-parts'
import { formatBuildTime } from '../images/image-cells'
import { TaskJobSheet } from './TaskJobSheet'
import { useOpenTask } from './use-open-task'

const PAGE_SIZE = 25
const EVERYBODY = '__everybody__'
const SEARCH_DEBOUNCE_MS = 300
const PERIODS = [
  { value: 'any', label: 'Any time', days: null },
  { value: 'today', label: 'Today', days: 0 },
  { value: 'week', label: 'Last 7 days', days: 6 },
  { value: 'month', label: 'Last 30 days', days: 29 }
] as const
type Period = (typeof PERIODS)[number]['value']

/** `YYYY-MM-DD` of the day `back` days before today, here. */
function dayBefore(back: number): string {
  const d = new Date()
  d.setDate(d.getDate() - back)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * IS-10, the console's /tasks on the phone: every task, newest first, narrowed by status, kind,
 * author, period and text. A row opens where it can in the app: a run's card or image, a job's log.
 */
export function BuildWebTasksView({
  active,
  onOpenIssue,
  onOpenImage
}: {
  active: boolean
  onOpenIssue: (issueId: string) => void
  onOpenImage: (image: string) => void
}) {
  const { call, hostCapabilities, status } = useBuildWebScreen()
  const supported = hostCapabilities.includes(BUILD_WEB_TASK_PAGE_RUNTIME_CAPABILITY)
  const [filters, setFilters] = useState<BuildWebTaskFilters>(NO_TASK_FILTERS)
  const [search, setSearch] = useState('')
  const [period, setPeriod] = useState<Period>('any')
  const [page, setPage] = useState(0)
  const [data, setData] = useState<BuildWebTaskPage | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const [picking, setPicking] = useState<'user' | 'period' | null>(null)
  const open = useOpenTask({ onOpenIssue, onOpenImage })
  const narrow = (next: Partial<BuildWebTaskFilters>) => {
    setFilters((current) => ({ ...current, ...next }))
    setPage(0)
  }
  useEffect(() => {
    const timer = setTimeout(() => narrow({ q: search }), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [search])
  const args = taskPageArgs(filters, page, PAGE_SIZE)
  const key = JSON.stringify(args)
  useEffect(() => {
    if (!active || !supported) {
      return
    }
    let alive = true
    setLoading(true)
    call('taskPage', args)
      .then((next) => alive && (setData(next), setError(null)))
      .catch((failure: unknown) => alive && setError(buildWebErrorMessage(failure)))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [active, call, key, reload, supported])

  if (!supported) {
    return (
      <Text style={styles.note}>
        This Orca server does not read the list of all build-web tasks yet. Update the server.
      </Text>
    )
  }
  const baseUrl = status.baseUrl ?? ''
  const pickPeriod = (value: Period) => {
    const days = PERIODS.find((p) => p.value === value)?.days ?? null
    setPeriod(value)
    narrow(days === null ? { from: '', to: '' } : { from: dayBefore(days), to: dayBefore(0) })
  }

  const row = ({ item: task }: { item: BuildWebConsoleTask }) => {
    const url = buildPageUrl(task, baseUrl)
    const at = formatBuildTime(task.started_at || task.created_at)
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => open.task(task)}
        style={({ pressed }) => [imageRowStyles.row, pressed ? styles.pressed : null]}
      >
        <View style={styles.grow}>
          <Text style={styles.title} numberOfLines={2}>
            {task.title}
          </Text>
          {task.detail ? (
            <Text style={styles.meta} numberOfLines={1}>
              {task.detail}
            </Text>
          ) : null}
          <Text style={styles.meta} numberOfLines={1}>
            {[at, taskKindLabel(task.kind), task.user].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <View style={styles.side}>
          <BuildWebToneChip label={task.status} tone={taskTone(task.status)} />
          {url ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Build page"
              hitSlop={8}
              onPress={() => open.buildPage(task, url)}
            >
              <FileText size={16} color={colors.textSecondary} />
            </Pressable>
          ) : null}
        </View>
      </Pressable>
    )
  }

  return (
    <View style={styles.root}>
      <View style={styles.search}>
        <MobileSearchField
          value={search}
          onChangeText={setSearch}
          onClear={() => setSearch('')}
          placeholder="Search: ticket, branch, stand, image…"
          accessibilityLabel="Search tasks"
        />
      </View>
      <View style={styles.filters}>
        <ImageFilterChips
          options={BUILD_WEB_TASK_STATES}
          selected={filters.states}
          label={(s) => BUILD_WEB_TASK_STATE_LABELS[s]}
          onToggle={(s) => narrow({ states: toggled(filters.states, s) })}
        />
        <ImageFilterChips
          options={BUILD_WEB_TASK_KINDS}
          selected={filters.kinds}
          label={taskKindLabel}
          onToggle={(k) => narrow({ kinds: toggled(filters.kinds, k) })}
        />
        <View style={styles.pills}>
          <FilterPill
            icon={User}
            label={filters.user || 'Everybody'}
            pressed={Boolean(filters.user)}
            onPress={() => setPicking('user')}
          />
          <FilterPill
            icon={CalendarDays}
            label={PERIODS.find((p) => p.value === period)?.label ?? 'Any time'}
            pressed={period !== 'any'}
            onPress={() => setPicking('period')}
          />
          {hasTaskFilters(filters) ? (
            <FilterPill
              icon={FilterX}
              label="Reset"
              onPress={() => {
                setSearch('')
                setPeriod('any')
                narrow(NO_TASK_FILTERS)
              }}
            />
          ) : null}
        </View>
      </View>
      <FlatList
        data={data?.tasks ?? []}
        keyExtractor={(task) => task.key}
        renderItem={row}
        style={styles.grow}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <ImageTableState
            error={error}
            loading={loading}
            empty
            emptyText="No tasks match"
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
      <PickerModal
        visible={picking === 'user'}
        title="Author"
        options={[
          { value: EVERYBODY, label: 'Everybody' },
          ...(data?.users ?? []).map((u) => ({ value: u, label: u }))
        ]}
        selected={filters.user || EVERYBODY}
        onSelect={(u) => narrow({ user: u === EVERYBODY ? '' : u })}
        onClose={() => setPicking(null)}
      />
      <PickerModal
        visible={picking === 'period'}
        title="Period"
        options={PERIODS.map((p) => ({ value: p.value, label: p.label }))}
        selected={period}
        onSelect={pickPeriod}
        onClose={() => setPicking(null)}
      />
      <TaskJobSheet task={open.job} onClose={open.closeJob} />
      <BuildLogSheet log={open.log} onClose={open.closeLog} />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
  grow: { flex: 1, minWidth: 0 },
  search: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  filters: { gap: spacing.xs, paddingVertical: spacing.sm },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, paddingHorizontal: spacing.md },
  side: { alignItems: 'flex-end', gap: spacing.sm },
  title: { color: colors.textPrimary, fontSize: typography.bodySize },
  meta: { color: colors.textSecondary, fontSize: typography.metaSize },
  pressed: { backgroundColor: colors.bgRaised },
  note: { color: colors.textSecondary, padding: spacing.md }
})
