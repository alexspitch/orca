import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { ChevronDown, ChevronUp } from 'lucide-react-native'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { MobileSearchField } from '../components/MobileSearchField'
import { MobileSwitch } from '../components/MobileSwitch'
import { chipTones, colors, spacing, typography } from '../theme/mobile-theme'

const MAX_MATCHES = 5000

/**
 * A log in a sheet: its lines, find, and following the end — a build's console log and a task
 * session's agent log alike.
 */
export function LogLinesPanel({
  title,
  lines,
  loading,
  error,
  note,
  headerAction,
  before
}: {
  title: string
  lines: readonly string[]
  loading: boolean
  error: string | null
  /** A short word about what is not shown, after the follow switch. */
  note?: string
  headerAction?: ReactNode
  /** Above the lines, e.g. reading the earlier part of the log. */
  before?: ReactNode
}) {
  const { height } = useWindowDimensions()
  const [follow, setFollow] = useState(true)
  const [query, setQuery] = useState('')
  const [current, setCurrent] = useState(0)
  const listRef = useRef<FlatList<string>>(null)
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
          {title}
        </Text>
        {loading ? <LoadingSpinner size={14} color={colors.textMuted} /> : null}
        {headerAction}
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
        {note ? <Text style={styles.muted}>· {note}</Text> : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {before}
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
