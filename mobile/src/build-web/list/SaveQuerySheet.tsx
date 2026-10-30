import { useState } from 'react'
import { StyleSheet, Text, TextInput, View } from 'react-native'
import type { BuildWebSavedQuery } from '../../../../src/shared/build-web-saved-query-types'
import {
  savedFilterOfView,
  storageProductOf
} from '../../../../src/renderer/src/components/build-web/saved-queries/saved-query-filter'
import { BottomDrawer } from '../../components/BottomDrawer'
import { MobileSwitch } from '../../components/MobileSwitch'
import { colors, spacing, typography } from '../../theme/mobile-theme'
import { buildWebErrorMessage } from '../build-web-operations'
import { useBuildWebScreen } from '../build-web-screen-context'
import { CardButton, ui } from '../issue/issue-card-ui'
import { savedQueryProductsRefusal } from './list-capability-gates'
import type { IssueList } from './use-issue-list'

/** The list's quick filters, statuses, products, assignees and search, kept in build-web as a saved filter. */
export function SaveQuerySheet({
  known,
  list,
  onClose
}: {
  /** The saved queries read last; null while closed. */
  known: readonly BuildWebSavedQuery[] | null
  list: Pick<IssueList, 'quick' | 'statuses' | 'products' | 'assignees' | 'query'>
  onClose: () => void
}) {
  return (
    <BottomDrawer visible={known !== null} onClose={onClose}>
      {known ? <SaveQueryForm known={known} list={list} onClose={onClose} /> : null}
    </BottomDrawer>
  )
}

// Why a separate form: it mounts per opening, so it starts from the filters of that moment.
function SaveQueryForm({
  known,
  list,
  onClose
}: {
  known: readonly BuildWebSavedQuery[]
  list: Pick<IssueList, 'quick' | 'statuses' | 'products' | 'assignees' | 'query'>
  onClose: () => void
}) {
  const { call, hostCapabilities, notify } = useBuildWebScreen()
  const [name, setName] = useState('')
  const [shared, setShared] = useState(false)
  const [saving, setSaving] = useState(false)
  const trimmed = name.trim()
  const sameName = known.filter((q) => q.mine && q.name.toLowerCase() === trimmed.toLowerCase())

  const save = async () => {
    const filter = savedFilterOfView(list)
    const refusal = savedQueryProductsRefusal(hostCapabilities, filter.product)
    if (refusal) {
      notify(refusal, 'error')
      return
    }
    setSaving(true)
    try {
      const result = await call('saveQuery', {
        product: storageProductOf(filter),
        name: trimmed,
        shared,
        filter
      })
      if (result.ok) {
        // Why: the console keys a name by the product it is kept under; in Orca a name is one query.
        await Promise.all(
          sameName
            .filter((q) => q.id !== result.value.id)
            .map((q) => call('deleteQuery', { id: q.id }).catch(() => null))
        )
        notify(`Saved «${trimmed}»`, 'success')
        onClose()
      } else {
        notify(result.error, 'error')
      }
    } catch (failure) {
      notify(buildWebErrorMessage(failure), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <View style={styles.form}>
      <Text style={styles.title}>Save query</Text>
      <Text style={ui.muted}>
        The quick filters, statuses, product and search of the list, kept in build-web with its
        saved filters.
      </Text>
      <TextInput
        autoFocus
        value={name}
        maxLength={200}
        onChangeText={setName}
        placeholder="Name"
        placeholderTextColor={colors.textMuted}
        accessibilityLabel="Name"
        style={ui.input}
        onSubmitEditing={() => trimmed && !saving && void save()}
      />
      {sameName.length ? <Text style={ui.muted}>Replaces your query of the same name.</Text> : null}
      <View style={styles.switchRow}>
        <View style={styles.switchText}>
          <Text style={styles.label}>Shared</Text>
          <Text style={ui.muted}>Everybody sees it; only you can delete it.</Text>
        </View>
        <MobileSwitch value={shared} onValueChange={setShared} accessibilityLabel="Shared" />
      </View>
      <View style={ui.saveRow}>
        <CardButton variant="ghost" label="Cancel" onPress={onClose} />
        <CardButton
          variant="primary"
          label="Save"
          disabled={!trimmed || saving}
          onPress={() => void save()}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  form: { gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  title: { color: colors.textPrimary, fontSize: 16, fontWeight: '600' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  switchText: { flex: 1, gap: 2 },
  label: { color: colors.textPrimary, fontSize: typography.bodySize }
})
