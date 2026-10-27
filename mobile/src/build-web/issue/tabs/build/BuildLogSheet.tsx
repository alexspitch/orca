import { useEffect, useMemo, useRef, useState } from 'react'
import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react-native'
import { BottomDrawer } from '../../../../components/BottomDrawer'
import { LoadingSpinner } from '../../../../components/LoadingSpinner'
import { MobileSearchField } from '../../../../components/MobileSearchField'
import { MobileSwitch } from '../../../../components/MobileSwitch'
import { openExternalLink } from '../../../../platform/external-link'
import { chipTones, colors, spacing, typography } from '../../../../theme/mobile-theme'
import { useBuildLog } from './use-build-log'

const MAX_MATCHES = 5000

/** A build's console log, followed while it runs, with find — the desktop's log dialog as a sheet. */
export function BuildLogSheet({
  log,
  onClose
}: {
  log: { url: string; title: string } | null
  onClose: () => void
}) {
  return (
    <BottomDrawer visible={log !== null} onClose={onClose} fillAvailable>
      {log ? <BuildLogBody key={log.url} log={log} /> : null}
    </BottomDrawer>
  )
}

// Why its own component: keyed by the log, its reads and find start over for another build.
function BuildLogBody({ log }: { log: { url: string; title: string } }) {
  const { height } = useWindowDimensions()
  const state = useBuildLog(log.url)
  const [follow, setFollow] = useState(true)
  const [query, setQuery] = useState('')
  const [current, setCurrent] = useState(0)
  const listRef = useRef<FlatList<string>>(null)
  const lines = state.lines
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) {
      return []
    }
    const found: number[] = []
    for (let i = 0; i < lines.length && found.length < MAX_MATCHES; i++) {
      if (lines[i]?.toLowerCase().includes(needle)) {
        found.push(i)
      }
    }
    return found
  }, [lines, query])

  useEffect(() => {
    if (follow && !query && lines.length > 0) {
      listRef.current?.scrollToEnd({ animated: false })
    }
  }, [follow, lines.length, query])

  const goTo = (index: number) => {
    if (matches.length === 0) {
      return
    }
    const next = (index + matches.length) % matches.length
    setCurrent(next)
    setFollow(false)
    listRef.current?.scrollToIndex({ index: matches[next] ?? 0, viewPosition: 0.3 })
  }
  const hit = new Set(matches)
  const focused = matches[current]

  return (
    <View style={[styles.sheet, { height: height * 0.85 }]}>
      <View style={styles.head}>
        <Text style={styles.title} numberOfLines={1}>
          {log.title}
        </Text>
        {!state.done && !state.error ? <LoadingSpinner size={14} color={colors.textMuted} /> : null}
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Open in Jenkins"
          hitSlop={8}
          onPress={() => openExternalLink(log.url)}
        >
          <ExternalLink size={16} color={colors.textSecondary} />
        </Pressable>
      </View>
      <View style={styles.find}>
        <View style={styles.grow}>
          <MobileSearchField
            value={query}
            onChangeText={(next) => {
              setQuery(next)
              setCurrent(0)
            }}
            onClear={() => setQuery('')}
            placeholder="Find in log"
            onSubmitEditing={() => goTo(current + 1)}
          />
        </View>
        <Text style={styles.muted}>
          {query ? `${matches.length ? current + 1 : 0}/${matches.length}` : ''}
        </Text>
        <Pressable
          accessibilityLabel="Previous match"
          hitSlop={6}
          onPress={() => goTo(current - 1)}
        >
          <ChevronUp size={18} color={colors.textSecondary} />
        </Pressable>
        <Pressable accessibilityLabel="Next match" hitSlop={6} onPress={() => goTo(current + 1)}>
          <ChevronDown size={18} color={colors.textSecondary} />
        </Pressable>
      </View>
      <View style={styles.followRow}>
        <MobileSwitch value={follow} onValueChange={setFollow} accessibilityLabel="Follow" />
        <Text style={styles.muted}>Follow the end</Text>
        {state.trimmed ? <Text style={styles.muted}>· only the tail is kept</Text> : null}
      </View>
      {state.error ? <Text style={styles.error}>{state.error}</Text> : null}
      <FlatList
        ref={listRef}
        data={lines}
        keyExtractor={(_line, index) => String(index)}
        renderItem={({ item, index }) => (
          <Text
            selectable
            style={[
              styles.line,
              hit.has(index) ? styles.hit : null,
              index === focused ? styles.focused : null
            ]}
          >
            {item || ' '}
          </Text>
        )}
        onScrollToIndexFailed={({ index }) =>
          listRef.current?.scrollToOffset({ offset: index * 16 })
        }
        onScrollBeginDrag={() => setFollow(false)}
        initialNumToRender={60}
        windowSize={11}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  sheet: { paddingHorizontal: spacing.md, gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1, color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  find: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  grow: { flex: 1 },
  followRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  muted: { color: colors.textMuted, fontSize: typography.metaSize },
  error: { color: colors.statusRed, fontSize: typography.metaSize },
  line: {
    color: colors.textPrimary,
    fontFamily: typography.monoFamily,
    fontSize: 11,
    lineHeight: 16
  },
  hit: { backgroundColor: `${chipTones.amber}33` },
  focused: { backgroundColor: `${chipTones.amber}73` }
})
