import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Copy, RotateCw } from 'lucide-react-native'
import type { BuildWebFreshnessRef } from '../../../../../../src/shared/build-web-run-types'
import {
  RUN_DISTS,
  RUN_PRODUCT_FILTERS,
  type RunFilter
} from '../../../../../../src/renderer/src/components/build-web/build-web-view-prefs'
import type { Cell } from '../../../../../../src/renderer/src/components/build-web/issue/build/run-cells'
import { MobileSwitch } from '../../../../components/MobileSwitch'
import { colors, radii, spacing, typography } from '../../../../theme/mobile-theme'
import { ImagePicker, SelectField } from './BuildPickers'
import { BuildTabButton, BuildTabTick, buildTabText } from './BuildTabControls'
import { formatAt } from './RunChips'

// The strips around a task's image list, after build-web's Progress: what the rows are measured
// against, how the list is narrowed, what the ticked rows can do, and how a row is added.

export function RunRefBar({
  refs,
  ticket,
  scanning,
  note,
  onRescan
}: {
  refs: BuildWebFreshnessRef[]
  ticket: string | null
  scanning: boolean
  note: string | null
  onRescan: () => void
}) {
  if (refs.length === 0 && !scanning) {
    return null
  }
  return (
    <View style={styles.refBar}>
      <View style={styles.wrapRow}>
        <Text style={buildTabText.muted}>
          {ticket ? `last commit of ${ticket}` : 'last commit'}
        </Text>
        <View style={styles.grow} />
        <BuildTabButton
          variant="ghost"
          icon={RotateCw}
          label={scanning ? 'Scanning…' : 'Rescan'}
          loading={scanning}
          accessibilityLabel="Fetch from Bitbucket and compare every built image with its branch again"
          onPress={onRescan}
        />
      </View>
      {refs.map((r) => (
        <Text key={r.branch} style={buildTabText.mono} numberOfLines={2}>
          {r.branch} · {formatAt(r.date) ?? r.date} · {r.commit.slice(0, 12)} — {r.subject}
        </Text>
      ))}
      {note ? <Text style={buildTabText.small}>{note}</Text> : null}
    </View>
  )
}

export function RunFilters({
  filter,
  onFilter,
  hidePending,
  onHidePending,
  shown,
  total
}: {
  filter: RunFilter
  onFilter: (filter: RunFilter) => void
  hidePending: boolean
  onHidePending: (on: boolean) => void
  shown: number
  total: number
}) {
  return (
    <View style={styles.wrapRow}>
      <SelectField
        title="dist"
        value={filter.dist}
        options={RUN_DISTS}
        onChange={(dist) => onFilter({ ...filter, dist })}
      />
      <SelectField
        title="product"
        value={filter.product}
        options={RUN_PRODUCT_FILTERS}
        onChange={(product) => onFilter({ ...filter, product })}
      />
      <View style={styles.inline}>
        <MobileSwitch
          value={hidePending}
          onValueChange={onHidePending}
          accessibilityLabel="Hide pending"
        />
        <Text style={buildTabText.muted}>Hide pending</Text>
      </View>
      <View style={styles.grow} />
      <Text style={buildTabText.muted}>
        {shown} of {total}
      </Text>
    </View>
  )
}

export function RunSelectionBar({
  selectable,
  picked,
  links,
  stale,
  failed,
  unpushed,
  busy,
  building,
  onPickAll,
  onCopy,
  onOpenBuild,
  onOpenPush
}: {
  selectable: number
  picked: number
  links: string[]
  stale: Cell[]
  failed: Cell[]
  unpushed: Cell[]
  busy: boolean
  building: boolean
  onPickAll: (on: boolean) => void
  onCopy: () => Promise<boolean>
  onOpenBuild: (cells: Cell[]) => void
  onOpenPush: (cells: Cell[]) => void
}) {
  const [copied, setCopied] = useState(false)
  const allPicked = selectable > 0 && picked === selectable
  return (
    <View style={styles.selection}>
      <View style={styles.inline}>
        <BuildTabTick
          checked={allPicked ? true : picked > 0 ? 'mixed' : false}
          onPress={() => onPickAll(!allPicked)}
          accessibilityLabel={
            allPicked ? 'Clear the selection' : 'Select every finished image shown'
          }
        />
        <Text style={[buildTabText.muted, styles.grow]}>
          {picked > 0
            ? `${picked} selected · ${links.length} reference(s)`
            : 'select images to build, publish or copy their references'}
        </Text>
      </View>
      <View style={styles.wrapRow}>
        <BuildTabButton
          icon={Copy}
          label={copied ? 'Copied' : 'Copy links'}
          disabled={links.length === 0}
          onPress={() =>
            void onCopy().then((ok) => {
              if (ok) {
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
              }
            })
          }
        />
        <BuildTabButton
          icon={RotateCw}
          label={`Rebuild stale (${stale.length})`}
          disabled={stale.length === 0 || busy}
          onPress={() => onOpenBuild(stale)}
        />
        <BuildTabButton
          icon={RotateCw}
          label={`Rebuild failed (${failed.length})`}
          disabled={failed.length === 0 || busy}
          onPress={() => onOpenBuild(failed)}
        />
        <BuildTabButton
          label={`Publish (${unpushed.length})`}
          disabled={unpushed.length === 0 || building || busy}
          onPress={() => onOpenPush(unpushed)}
        />
      </View>
    </View>
  )
}

const ADD_DISTS = ['rhel', 'redos', 'both'] as const

export function RunAddImage({
  images,
  branches,
  runBranch,
  defaultDist,
  disabled,
  onAdd
}: {
  images: string[]
  branches: string[]
  runBranch: string
  defaultDist: string
  disabled: boolean
  onAdd: (image: string, dist: string, branch: string) => Promise<boolean>
}) {
  const [image, setImage] = useState<string | null>(null)
  const [dist, setDist] = useState<(typeof ADD_DISTS)[number]>(
    defaultDist === 'rhel' || defaultDist === 'redos' ? defaultDist : 'both'
  )
  // The branch last used: the common case is a series of images on one branch.
  const [branch, setBranch] = useState(runBranch)
  const offered = branches.includes(runBranch) ? branches : [runBranch, ...branches]
  return (
    <View style={styles.add}>
      <ImagePicker images={images} value={image} onChange={setImage} disabled={disabled} />
      <View style={styles.wrapRow}>
        <SelectField
          title="dist"
          value={dist}
          options={ADD_DISTS}
          onChange={setDist}
          disabled={disabled}
        />
        <SelectField
          title="Branch"
          value={branch}
          options={offered}
          onChange={setBranch}
          disabled={disabled}
          mono
        />
        <BuildTabButton
          label="Add"
          disabled={!image || disabled}
          onPress={() => {
            if (image) {
              void onAdd(image, dist, branch).then((ok) => ok && setImage(null))
            }
          }}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  refBar: {
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radii.input,
    backgroundColor: colors.bgRaised
  },
  selection: { gap: spacing.sm },
  add: {
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle
  },
  label: { color: colors.textMuted, fontSize: typography.metaSize }
})
