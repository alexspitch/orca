import { useCallback, useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Plus, Trash2, TriangleAlert, Users } from 'lucide-react-native'
import type { BuildWebSavedQuery } from '../../../../src/shared/build-web-saved-query-types'
import { BUILD_WEB_PRODUCTS } from '../../../../src/shared/build-web-types'
import { viewOfSavedFilter } from '../../../../src/renderer/src/components/build-web/saved-queries/saved-query-filter'
import { BottomDrawer } from '../../components/BottomDrawer'
import { chipTones, colors, spacing, typography } from '../../theme/mobile-theme'
import { buildWebErrorMessage } from '../build-web-operations'
import { useBuildWebScreen } from '../build-web-screen-context'
import { ProductChip } from '../BuildWebToneChip'
import { savedQueriesRefusal } from './list-capability-gates'
import { unsupportedText } from './saved-query-text'
import type { QueryTabs } from './use-query-tabs'
import { useConfirmPrompt } from './use-confirm-prompt'

/** build-web's saved filters of the Issues table, run and deleted here; Save adds the list's own. */
export function SavedQueriesSheet({
  visible,
  tabs,
  onSaveCurrent,
  onClose
}: {
  visible: boolean
  tabs: QueryTabs
  onSaveCurrent: (known: readonly BuildWebSavedQuery[]) => void
  onClose: () => void
}) {
  const { call, hostCapabilities, notify } = useBuildWebScreen()
  const { confirm, element: confirmElement } = useConfirmPrompt()
  const [queries, setQueries] = useState<BuildWebSavedQuery[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const refusal = savedQueriesRefusal(hostCapabilities)

  const load = useCallback(async () => {
    if (refusal) {
      setError(refusal)
      return
    }
    try {
      // Why every product: a query switches the list's product, and its list must not change with it.
      setQueries(await call('savedQueries', { products: [...BUILD_WEB_PRODUCTS] }))
      setError(null)
    } catch (failure) {
      setError(buildWebErrorMessage(failure))
    }
  }, [call, refusal])

  useEffect(() => {
    if (visible) {
      void load()
    }
  }, [load, visible])

  const apply = (query: BuildWebSavedQuery) => {
    onClose()
    const unsupported = tabs.openQueryTab(query)
    if (unsupported.length) {
      notify(`${query.name}: ${unsupportedText(unsupported)}`)
    }
  }

  const remove = async (query: BuildWebSavedQuery) => {
    const accepted = await confirm({
      title: `Delete «${query.name}»?`,
      message: query.shared
        ? 'It is shared: it goes for everybody, in build-web too.'
        : 'It goes in build-web too.',
      confirmLabel: 'Delete',
      destructive: true
    })
    if (!accepted) {
      return
    }
    try {
      const result = await call('deleteQuery', { id: query.id })
      if (result.ok) {
        setQueries((current) => current?.filter((q) => q.id !== query.id) ?? null)
        tabs.closeQueryTab(query.id)
      } else {
        notify(result.error, 'error')
      }
    } catch (failure) {
      notify(buildWebErrorMessage(failure), 'error')
    }
  }

  return (
    <>
      <BottomDrawer visible={visible} onClose={onClose}>
        <Text style={styles.title}>Saved queries</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {queries === null && !error ? <Text style={styles.muted}>Loading…</Text> : null}
        {queries?.length === 0 ? <Text style={styles.muted}>No saved queries yet</Text> : null}
        <ScrollView style={styles.list}>
          {queries?.map((query) => {
            const { unsupported } = viewOfSavedFilter(query.filter)
            return (
              <Pressable
                key={query.id}
                accessibilityRole="button"
                onPress={() => apply(query)}
                style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
              >
                <View style={styles.rowMain}>
                  <Text style={styles.name} numberOfLines={1}>
                    {query.name}
                  </Text>
                  <View style={styles.meta}>
                    {BUILD_WEB_PRODUCTS.filter((p) => query.filter.product.includes(p)).map((p) => (
                      <ProductChip key={p} product={p} />
                    ))}
                    {query.shared ? (
                      <View style={styles.shared}>
                        <Users size={12} color={colors.textMuted} />
                        <Text style={styles.metaText}>{query.owner}</Text>
                      </View>
                    ) : null}
                  </View>
                  {unsupported.length ? (
                    <View style={styles.shared}>
                      <TriangleAlert size={12} color={chipTones.amber} />
                      <Text style={styles.metaText}>{unsupportedText(unsupported)}</Text>
                    </View>
                  ) : null}
                </View>
                {query.mine ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Delete «${query.name}»`}
                    hitSlop={8}
                    onPress={() => void remove(query)}
                    style={styles.icon}
                  >
                    <Trash2 size={16} color={colors.textMuted} />
                  </Pressable>
                ) : null}
              </Pressable>
            )
          })}
        </ScrollView>
        <Pressable
          accessibilityRole="button"
          disabled={Boolean(refusal)}
          onPress={() => {
            onClose()
            onSaveCurrent(queries ?? [])
          }}
          style={({ pressed }) => [
            styles.row,
            refusal ? styles.disabled : null,
            pressed ? styles.pressed : null
          ]}
        >
          <Plus size={16} color={colors.textPrimary} />
          <Text style={styles.name}>Save current query…</Text>
        </Pressable>
      </BottomDrawer>
      {confirmElement}
    </>
  )
}

const styles = StyleSheet.create({
  title: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm
  },
  list: { maxHeight: 420 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm
  },
  rowMain: { flex: 1, minWidth: 0, gap: spacing.xs },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs },
  shared: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  name: { color: colors.textPrimary, fontSize: typography.bodySize },
  muted: {
    color: colors.textMuted,
    fontSize: typography.metaSize,
    paddingHorizontal: spacing.lg
  },
  metaText: { color: colors.textMuted, fontSize: typography.metaSize, flexShrink: 1 },
  error: { color: colors.statusRed, fontSize: typography.metaSize, paddingHorizontal: spacing.lg },
  icon: { padding: spacing.xs },
  pressed: { backgroundColor: colors.bgRaised },
  disabled: { opacity: 0.45 }
})
