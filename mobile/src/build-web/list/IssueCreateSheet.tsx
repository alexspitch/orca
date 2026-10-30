import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import {
  BUILD_WEB_ISSUE_TYPES,
  BUILD_WEB_PRODUCTS,
  BUILD_WEB_STATUSES,
  type BuildWebIssueDraft,
  type BuildWebProduct,
  type BuildWebStatus,
  type BuildWebVersion
} from '../../../../src/shared/build-web-types'
import type { BuildWebTmsStand } from '../../../../src/shared/build-web-task-types'
import { stepsOfLines } from '../../../../src/shared/build-web-issue-steps'
import { BottomDrawer } from '../../components/BottomDrawer'
import { MobileSwitch } from '../../components/MobileSwitch'
import { colors, spacing, typography } from '../../theme/mobile-theme'
import {
  BUILD_WEB_PRIORITIES,
  loginOf,
  priorityLabel,
  productLabel,
  statusLabel,
  typeLabel
} from '../build-web-labels'
import { buildWebErrorMessage } from '../build-web-operations'
import { useBuildWebScreen } from '../build-web-screen-context'
import { PriorityChip, StatusChip, TypeChip } from '../BuildWebToneChip'
import { CardButton, ui } from '../issue/issue-card-ui'
import { PropertyRow, PropertySelect } from '../issue/IssuePropertySelect'
import { useBuildWebAssignees } from './use-build-web-assignees'

const NONE = '__none__'
type IssueType = (typeof BUILD_WEB_ISSUE_TYPES)[number]
type Stand = { id: string; mode: string; version: string }

/** A new build-web task, with every field the console's create takes but the parent. */
export function IssueCreateSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <BottomDrawer visible={visible} onClose={onClose}>
      {visible ? <IssueCreateForm onClose={onClose} /> : null}
    </BottomDrawer>
  )
}

/** The release and stand lists of the chosen product; a late answer for another product is dropped. */
function useProductLists(product: BuildWebProduct | null): {
  versions: BuildWebVersion[]
  stands: BuildWebTmsStand[]
} {
  const { call } = useBuildWebScreen()
  const [lists, setLists] = useState<{
    product: BuildWebProduct
    versions: BuildWebVersion[]
    stands: BuildWebTmsStand[]
  } | null>(null)
  useEffect(() => {
    if (!product) {
      return
    }
    let alive = true
    void Promise.all([
      call('listVersions', { product }).catch(() => []),
      call('tmsStands', { product }).catch(() => [])
    ]).then(([versions, stands]) => alive && setLists({ product, versions, stands }))
    return () => {
      alive = false
    }
  }, [call, product])
  return lists && lists.product === product ? lists : { versions: [], stands: [] }
}

// Why a separate form: it mounts per opening, so it starts empty.
function IssueCreateForm({ onClose }: { onClose: () => void }) {
  const { call, notify, openIssue, listSync } = useBuildWebScreen()
  const [product, setProduct] = useState<BuildWebProduct | null>(null)
  const [title, setTitle] = useState('')
  const [type, setType] = useState<IssueType>('bug')
  const [status, setStatus] = useState<BuildWebStatus>('todo')
  const [priority, setPriority] = useState(3)
  const [assignee, setAssignee] = useState('')
  const [versionId, setVersionId] = useState<string | null>(null)
  const [stand, setStand] = useState<Stand | null>(null)
  const [forAi, setForAi] = useState(false)
  const [description, setDescription] = useState('')
  const [steps, setSteps] = useState('')
  const [reading, setReading] = useState(false)
  const [saving, setSaving] = useState(false)
  const people = useBuildWebAssignees(true)
  const { versions, stands } = useProductLists(product)
  const trimmed = title.trim()
  const busy = saving || reading

  const chooseProduct = (next: string) => {
    const found = BUILD_WEB_PRODUCTS.find((p) => p === next)
    if (found && found !== product) {
      setProduct(found)
      // Why: a release and a stand belong to one product, as the console's product change clears them.
      setVersionId(null)
      setStand(null)
    }
  }

  /** The stand's build and mode are read off it and frozen, as the card does. */
  const chooseStand = async (standId: string | null) => {
    if (!standId) {
      setStand(null)
      return
    }
    setReading(true)
    const read = await call('standVersion', { standId }).catch(() => null)
    setReading(false)
    setStand({ id: standId, mode: read?.mode ?? '', version: read?.version ?? '' })
    if (read && !read.version) {
      notify(read.error ?? 'The version could not be read off the stand.')
    }
  }

  const create = async () => {
    if (!product || !trimmed) {
      return
    }
    const lines = stepsOfLines(steps)
    const draft: BuildWebIssueDraft = {
      product,
      title: trimmed,
      type,
      status,
      priority,
      assignee,
      for_ai: forAi,
      ...(versionId ? { version_id: versionId } : {}),
      ...(stand ? { stand_id: stand.id, stand_mode: stand.mode, version: stand.version } : {}),
      ...(description.trim() ? { description } : {}),
      ...(lines.length ? { steps: lines } : {})
    }
    setSaving(true)
    try {
      const result = await call('createIssue', { draft })
      if (result.ok) {
        notify(`Created ${result.value.key}`, 'success')
        listSync.reload()
        onClose()
        openIssue(result.value.id)
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
    <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>New task</Text>
      <TextInput
        autoFocus
        value={title}
        maxLength={500}
        onChangeText={setTitle}
        placeholder="Title"
        placeholderTextColor={colors.textMuted}
        accessibilityLabel="Title"
        style={ui.input}
      />
      <View>
        <PropertyRow label="Product">
          <PropertySelect
            label="Product"
            value={product ?? NONE}
            disabled={busy}
            onChange={chooseProduct}
            options={[
              ...(product ? [] : [{ value: NONE, label: 'Choose' }]),
              ...BUILD_WEB_PRODUCTS.map((p) => ({ value: p, label: productLabel(p) }))
            ]}
          />
        </PropertyRow>
        <PropertyRow label="Type">
          <PropertySelect
            label="Type"
            value={type}
            shown={<TypeChip type={type} />}
            disabled={busy}
            onChange={setType}
            options={BUILD_WEB_ISSUE_TYPES.map((t) => ({ value: t, label: typeLabel(t) }))}
          />
        </PropertyRow>
        <PropertyRow label="Status">
          <PropertySelect
            label="Status"
            value={status}
            shown={<StatusChip status={status} />}
            disabled={busy}
            onChange={setStatus}
            options={BUILD_WEB_STATUSES.map((s) => ({ value: s, label: statusLabel(s) }))}
          />
        </PropertyRow>
        <PropertyRow label="Priority">
          <PropertySelect
            label="Priority"
            value={String(priority)}
            shown={<PriorityChip priority={priority} />}
            disabled={busy}
            onChange={(v) => setPriority(Number(v))}
            options={BUILD_WEB_PRIORITIES.map((p) => ({
              value: String(p),
              label: priorityLabel(p)
            }))}
          />
        </PropertyRow>
        <PropertyRow label="Assignee">
          <PropertySelect
            label="Assignee"
            value={assignee || NONE}
            disabled={busy}
            onChange={(v) => setAssignee(v === NONE ? '' : v)}
            options={[
              { value: NONE, label: 'Unassigned' },
              ...people.map((u) => ({ value: u.email, label: loginOf(u.email), subtitle: u.name }))
            ]}
          />
        </PropertyRow>
        <PropertyRow label="Version">
          <PropertySelect
            label="Product version"
            value={versionId ?? NONE}
            disabled={busy || !product}
            onChange={(v) => setVersionId(v === NONE ? null : v)}
            options={[
              { value: NONE, label: 'Not set' },
              ...versions.map((v) => ({ value: v.id, label: v.name }))
            ]}
          />
        </PropertyRow>
        <PropertyRow label="Stand">
          <PropertySelect
            label="Stand"
            value={stand?.id ?? NONE}
            disabled={busy || !product}
            onChange={(v) => void chooseStand(v === NONE ? null : v)}
            options={[
              { value: NONE, label: 'Not set' },
              ...stands.map((s) => ({ value: s.id, label: s.name }))
            ]}
          />
        </PropertyRow>
        <PropertyRow label="Handed to AI">
          <MobileSwitch value={forAi} onValueChange={setForAi} accessibilityLabel="Handed to AI" />
        </PropertyRow>
      </View>
      <TextInput
        multiline
        value={description}
        onChangeText={setDescription}
        placeholder="Description, Markdown"
        placeholderTextColor={colors.textMuted}
        accessibilityLabel="Description"
        style={[ui.input, styles.multiline]}
      />
      <TextInput
        multiline
        value={steps}
        onChangeText={setSteps}
        placeholder="Steps, one per line"
        placeholderTextColor={colors.textMuted}
        accessibilityLabel="Steps"
        style={[ui.input, styles.multiline]}
      />
      <View style={ui.saveRow}>
        <CardButton variant="ghost" label="Cancel" onPress={onClose} />
        <CardButton
          variant="primary"
          label="Create"
          disabled={!product || !trimmed || busy}
          onPress={() => void create()}
        />
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  form: { gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  title: { color: colors.textPrimary, fontSize: 16, fontWeight: '600' },
  multiline: { minHeight: 88, textAlignVertical: 'top', fontSize: typography.bodySize }
})
