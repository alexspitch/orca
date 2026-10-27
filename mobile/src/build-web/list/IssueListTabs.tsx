import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { X } from 'lucide-react-native'
import { colors, radii, spacing, typography } from '../../theme/mobile-theme'
import type { QueryTabs } from './use-query-tabs'
import type { RecentTasks } from './use-recent-tasks'

function Tab({
  label,
  active,
  mono,
  onPress,
  onClose,
  closeLabel
}: {
  label: string
  active?: boolean
  mono?: boolean
  onPress: () => void
  onClose?: () => void
  closeLabel?: string
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: Boolean(active) }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tab,
        active ? styles.tabActive : null,
        pressed ? styles.pressed : null
      ]}
    >
      <Text
        style={[styles.tabText, active ? styles.tabTextActive : null, mono ? styles.mono : null]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {onClose ? (
        <Pressable
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
          onPress={onClose}
        >
          <X size={12} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </Pressable>
  )
}

/** The desktop's tab strip: the List, each saved query's tab, then the tasks opened lately. */
export function IssueListTabs({
  queryTabId,
  queryTabs,
  recent,
  onOpenTask
}: {
  queryTabId: string | null
  queryTabs: QueryTabs
  recent: RecentTasks
  onOpenTask: (id: string) => void
}) {
  if (queryTabs.tabs.length === 0 && recent.tabs.length === 0) {
    return null
  }
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.strip}
      style={styles.wrap}
    >
      <Tab label="List" active={queryTabId === null} onPress={queryTabs.showPlainList} />
      {queryTabs.tabs.map((tab) => (
        <Tab
          key={tab.id}
          label={tab.name}
          active={queryTabId === tab.id}
          onPress={() => queryTabs.showQueryTab(tab.id)}
          onClose={() => queryTabs.closeQueryTab(tab.id)}
          closeLabel={`Close «${tab.name}»`}
        />
      ))}
      {recent.tabs.length ? <View style={styles.divider} /> : null}
      {recent.tabs.map((tab) => (
        <Tab
          key={tab.id}
          label={tab.key ?? tab.title ?? tab.id}
          mono={Boolean(tab.key)}
          onPress={() => onOpenTask(tab.id)}
          onClose={() => recent.close(tab.id)}
          closeLabel={`Close ${tab.key ?? 'task'}`}
        />
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle },
  strip: { alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, height: 40 },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    maxWidth: 180,
    height: 28,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radii.button
  },
  tabActive: { backgroundColor: colors.bgRaised },
  pressed: { opacity: 0.7 },
  tabText: { color: colors.textMuted, fontSize: typography.metaSize },
  tabTextActive: { color: colors.textPrimary, fontWeight: '600' },
  mono: { fontFamily: typography.monoFamily },
  divider: { width: 1, height: 18, backgroundColor: colors.borderSubtle, marginHorizontal: 4 }
})
