import { useCallback, useEffect, useState } from 'react'
import { Pressable, Text } from 'react-native'
import { RefreshCw } from 'lucide-react-native'
import {
  BUILD_WEB_ISSUE_TYPES,
  BUILD_WEB_PRODUCTS,
  BUILD_WEB_SUBTASK_STATUSES,
  type BuildWebIssueDetail,
  type BuildWebIssuePatch,
  type BuildWebUser,
  type BuildWebVersion
} from '../../../../src/shared/build-web-types'
import {
  BUILD_WEB_TESTING_STATUSES,
  type BuildWebTestingStatus
} from '../../../../src/shared/build-web-run-types'
import type { BuildWebTmsStand } from '../../../../src/shared/build-web-task-types'
import { MobileSwitch } from '../../components/MobileSwitch'
import { chipTones, colors } from '../../theme/mobile-theme'
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
import { MutedText, ui } from './issue-card-ui'
import { PropertyRow, PropertySelect } from './IssuePropertySelect'

const NONE = '__none__'

/**
 * A task's «Properties», after build-web's card: who does it, for which product, stand and release,
 * of what kind and how urgent — and, for a task with builds, where its build is headed. A subtask
 * takes the product, priority, release, stand and build from its parent.
 */
export function IssueProperties({
  detail,
  assignees,
  versions,
  disabled,
  onSave,
  onReload,
  testing,
  onOpenParent
}: {
  detail: BuildWebIssueDetail
  assignees: BuildWebUser[]
  versions: BuildWebVersion[]
  disabled: boolean
  onSave: (patch: BuildWebIssuePatch) => Promise<unknown> | void
  onReload: () => void
  /** Where the build is headed; absent where the card does not read builds. */
  testing: { value: BuildWebTestingStatus; onChange: (value: BuildWebTestingStatus) => void } | null
  onOpenParent: (id: string) => void
}) {
  const { call, notify } = useBuildWebScreen()
  const child = Boolean(detail.parent_id)
  const [stands, setStands] = useState<{ product: string; list: BuildWebTmsStand[] } | null>(null)
  // Why its own copy: the card's list is read with the task, before a release added since.
  const [releases, setReleases] = useState<{ product: string; list: BuildWebVersion[] } | null>(
    null
  )
  const [reading, setReading] = useState(false)
  const product = child ? 'unknown' : detail.product
  const loadStands = useCallback(() => {
    if (product === 'unknown') {
      return
    }
    void call('tmsStands', { product }).then(
      (list) => setStands({ product, list }),
      () => undefined
    )
  }, [call, product])
  const loadReleases = useCallback(() => {
    if (product === 'unknown') {
      return
    }
    void call('listVersions', { product }).then(
      (list) => setReleases({ product, list }),
      () => undefined
    )
  }, [call, product])
  useEffect(loadStands, [loadStands])
  // Why keyed by product: a late answer for the product just left must not be offered here.
  const standList = stands?.product === product ? stands.list : []
  const versionList = releases?.product === product ? releases.list : versions
  const busy = disabled || reading

  /** Another stand is another build and another mode: both are read off it and frozen again. */
  const chooseStand = async (standId: string | null) => {
    if (!standId) {
      await onSave({ stand_id: null, stand_mode: '', version: '' })
      return
    }
    setReading(true)
    const read = await call('standVersion', { standId }).catch(() => null)
    setReading(false)
    await onSave({ stand_id: standId, stand_mode: read?.mode ?? '', version: read?.version ?? '' })
    if (read && !read.version) {
      notify(read.error ?? 'The version could not be read off the stand.')
    }
  }

  const rereadVersion = async () => {
    setReading(true)
    try {
      const result = await call('refreshIssueVersion', { id: detail.id })
      if (result.ok) {
        notify('Version read again off the stand.', 'success')
        onReload()
      } else {
        notify(result.error, 'error')
      }
    } catch (failure) {
      notify(buildWebErrorMessage(failure), 'error')
    } finally {
      setReading(false)
    }
  }

  const people = [
    { value: NONE, label: 'Unassigned' },
    ...assignees.map((u) => ({ value: u.email, label: loginOf(u.email), subtitle: u.name })),
    ...(detail.assignee && !assignees.some((u) => u.email === detail.assignee)
      ? [{ value: detail.assignee, label: loginOf(detail.assignee) }]
      : [])
  ]
  const standOptions = [
    { value: NONE, label: 'Not set' },
    ...standList.map((s) => ({ value: s.id, label: s.name })),
    ...(detail.stand_id && !standList.some((s) => s.id === detail.stand_id)
      ? [{ value: detail.stand_id, label: detail.stand_name ?? detail.stand_id }]
      : [])
  ]
  const versionOptions = [
    { value: NONE, label: 'Not set' },
    ...versionList.map((v) => ({ value: v.id, label: v.name })),
    ...(detail.version_id && !versionList.some((v) => v.id === detail.version_id)
      ? [{ value: detail.version_id, label: detail.version_name ?? detail.version_id }]
      : [])
  ]
  const knownType = BUILD_WEB_ISSUE_TYPES.find((t) => t === detail.type)

  return (
    <>
      {child ? (
        <PropertyRow label="Status">
          <PropertySelect<string>
            label="Subtask status"
            value={detail.status}
            shown={<StatusChip status={detail.status} />}
            disabled={busy}
            options={BUILD_WEB_SUBTASK_STATUSES.map((s) => ({ value: s, label: statusLabel(s) }))}
            onChange={(v) => {
              const status = BUILD_WEB_SUBTASK_STATUSES.find((s) => s === v)
              if (status) {
                void onSave({ status })
              }
            }}
          />
        </PropertyRow>
      ) : null}
      <PropertyRow label="Assignee">
        <PropertySelect
          label="Assignee"
          value={detail.assignee || NONE}
          disabled={busy}
          options={people}
          onChange={(v) => void onSave({ assignee: v === NONE ? '' : v })}
        />
      </PropertyRow>
      {child ? null : (
        <>
          <PropertyRow label="Product">
            <PropertySelect
              label="Product"
              value={detail.product === 'unknown' ? NONE : detail.product}
              disabled={busy}
              options={BUILD_WEB_PRODUCTS.map((p) => ({ value: p, label: productLabel(p) }))}
              onChange={(v) => {
                const next = BUILD_WEB_PRODUCTS.find((p) => p === v)
                if (next && next !== detail.product) {
                  void onSave({ product: next })
                }
              }}
            />
          </PropertyRow>
          <PropertyRow label="Stand">
            <PropertySelect
              label="Stand"
              value={detail.stand_id ?? NONE}
              disabled={busy}
              options={standOptions}
              onOpen={loadStands}
              onChange={(v) => void chooseStand(v === NONE ? null : v)}
            />
            {detail.stand_id ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Read the version off the stand again"
                disabled={busy}
                hitSlop={8}
                onPress={() => void rereadVersion()}
              >
                <RefreshCw
                  size={16}
                  color={detail.version ? colors.textSecondary : chipTones.amber}
                />
              </Pressable>
            ) : null}
          </PropertyRow>
          {detail.stand_id ? (
            <MutedText>
              {detail.version
                ? `On the stand: ${detail.version}${detail.stand_mode ? ` · ${detail.stand_mode}` : ''}`
                : 'The stand’s version is not read yet'}
            </MutedText>
          ) : null}
          <PropertyRow label="Version">
            <PropertySelect
              label="Product version"
              value={detail.version_id ?? NONE}
              disabled={busy}
              options={versionOptions}
              onOpen={loadReleases}
              onChange={(v) => void onSave({ version_id: v === NONE ? null : v })}
            />
          </PropertyRow>
        </>
      )}
      <PropertyRow label="Type">
        <PropertySelect
          label="Type"
          value={knownType ?? NONE}
          shown={<TypeChip type={detail.type} />}
          disabled={busy}
          options={[
            ...(knownType ? [] : [{ value: NONE, label: typeLabel(detail.type) }]),
            ...BUILD_WEB_ISSUE_TYPES.map((t) => ({ value: t, label: typeLabel(t) }))
          ]}
          onChange={(v) => {
            const type = BUILD_WEB_ISSUE_TYPES.find((t) => t === v)
            if (type && type !== detail.type) {
              void onSave({ type })
            }
          }}
        />
      </PropertyRow>
      {child ? null : (
        <PropertyRow label="Priority">
          <PropertySelect
            label="Priority"
            value={String(detail.priority)}
            shown={<PriorityChip priority={detail.priority} />}
            disabled={busy}
            options={BUILD_WEB_PRIORITIES.map((p) => ({
              value: String(p),
              label: priorityLabel(p)
            }))}
            onChange={(v) => void onSave({ priority: Number(v) })}
          />
        </PropertyRow>
      )}
      {testing && !child ? (
        <PropertyRow label="Testing">
          <PropertySelect
            label="Testing"
            value={testing.value}
            disabled={busy}
            options={BUILD_WEB_TESTING_STATUSES.map((s) => ({ value: s, label: s }))}
            onChange={testing.onChange}
          />
        </PropertyRow>
      ) : null}
      <PropertyRow label="Handed to AI">
        <MobileSwitch
          value={detail.for_ai}
          disabled={busy}
          accessibilityLabel="Handed to AI"
          onValueChange={(checked) => void onSave({ for_ai: checked })}
        />
      </PropertyRow>
      {child && detail.parent_id ? (
        <Text style={ui.muted}>
          Product, priority, version, stand and build — from the parent{' '}
          <Text
            style={[ui.link, ui.mono]}
            onPress={() => detail.parent_id && onOpenParent(detail.parent_id)}
          >
            {detail.parent_key}
          </Text>
          .
        </Text>
      ) : null}
    </>
  )
}
