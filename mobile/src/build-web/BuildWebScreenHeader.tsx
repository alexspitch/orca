import { Pressable, StyleSheet, Text, View } from 'react-native'
import { ChevronLeft, MoreHorizontal, Plus, RefreshCw } from 'lucide-react-native'
import type { BuildWebConnectionStatus } from '../../../src/shared/build-web-types'
import { StatusDot } from '../components/StatusDot'
import type { ConnectionState } from '../transport/types'
import { colors, spacing, typography } from '../theme/mobile-theme'

/** The Issues screen's top row: Back, the section and account, and the page's buttons once connected. */
export function BuildWebScreenHeader({
  title,
  connState,
  status,
  onBack,
  onCreate,
  onRefresh,
  onMore
}: {
  title: string
  connState: ConnectionState
  status: BuildWebConnectionStatus | null
  onBack: () => void
  /** Null where no task can be created from. */
  onCreate: (() => void) | null
  onRefresh: () => void
  onMore: () => void
}) {
  return (
    <View style={styles.header}>
      <Pressable
        style={styles.iconButton}
        onPress={onBack}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <ChevronLeft size={22} color={colors.textPrimary} />
      </Pressable>
      <View style={styles.titleWrap}>
        <View style={styles.titleLine}>
          <StatusDot state={connState} />
          <Text style={styles.title}>{title}</Text>
        </View>
        {status?.connected ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {status.login} · {status.baseUrl?.replace(/^https?:\/\//, '')}
          </Text>
        ) : null}
      </View>
      {status?.connected ? (
        <>
          {onCreate ? (
            <Pressable
              style={styles.iconButton}
              onPress={onCreate}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="New task"
            >
              <Plus size={18} color={colors.textSecondary} />
            </Pressable>
          ) : null}
          <Pressable
            style={styles.iconButton}
            onPress={onRefresh}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Refresh"
          >
            <RefreshCw size={16} color={colors.textSecondary} />
          </Pressable>
          <Pressable
            style={styles.iconButton}
            onPress={onMore}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="More"
          >
            <MoreHorizontal size={18} color={colors.textSecondary} />
          </Pressable>
        </>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle
  },
  iconButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  titleWrap: { flex: 1, minWidth: 0 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { color: colors.textPrimary, fontSize: typography.titleSize, fontWeight: '600' },
  subtitle: { color: colors.textMuted, fontSize: typography.metaSize }
})
