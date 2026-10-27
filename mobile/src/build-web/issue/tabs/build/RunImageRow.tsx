import { memo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { CircleStop, Play, RotateCw, Trash2 } from 'lucide-react-native'
import type {
  BuildWebBuildFreshness,
  BuildWebCombo,
  BuildWebLastBuilt
} from '../../../../../../src/shared/build-web-run-types'
import {
  comboOf,
  isSelectable,
  type Cell
} from '../../../../../../src/renderer/src/components/build-web/issue/build/run-cells'
import { openExternalLink } from '../../../../platform/external-link'
import { colors, spacing, typography } from '../../../../theme/mobile-theme'
import { BuildWebToneChip } from '../../../BuildWebToneChip'
import { BuildTabButton, BuildTabTick } from './BuildTabControls'
import {
  CellStateChip,
  formatAt,
  FreshnessChip,
  LastBuiltChips,
  RegistryChip,
  TipChip
} from './RunChips'
import { RunTwinChip } from './RunTwinChip'

export type RunRowContext = {
  runBranch: string
  ticket: string | null
  now: number
  busy: boolean
  building: boolean
  testDirs: Record<string, string[]>
  baseUrl: string | null
  onOpenBuild: (combos: BuildWebCombo[]) => void
  onOpenPush: (cells: Cell[]) => void
  onCancel: (cell: Cell) => void
  onRetryTwin: (cell: Cell) => void
  onRemove: (combo: BuildWebCombo) => void
  onOpenLog: (url: string, title: string) => void
}

function RunImageRowView({
  cell: c,
  picked,
  onPick,
  pushing,
  cancelling,
  retrying,
  lastBuilt,
  freshness,
  ctx
}: {
  cell: Cell
  picked: boolean
  onPick: (cell: Cell) => void
  pushing: boolean
  cancelling: boolean
  /** A Retry of this twin is on its way. */
  retrying: boolean
  lastBuilt: BuildWebLastBuilt | undefined
  freshness: BuildWebBuildFreshness | undefined
  ctx: RunRowContext
}) {
  const live = c.state === 'queued' || c.state === 'building'
  // Why: the console derives this row from its rhel one — a rebuild here would rebuild rhel.
  const derived = c.twin === 'derive'
  const testDirs = ctx.testDirs[c.image] ?? []
  const meta = [c.number !== null ? `#${c.number}` : null, formatAt(c.startedAt)]
    .filter(Boolean)
    .join(' · ')
  return (
    <View style={styles.row}>
      <View style={styles.head}>
        {isSelectable(c) ? (
          <BuildTabTick
            checked={picked}
            onPress={() => onPick(c)}
            accessibilityLabel={`Select ${c.image} (${c.dist})`}
          />
        ) : null}
        <View style={styles.name}>
          <Text style={styles.image} numberOfLines={1}>
            {c.image}
          </Text>
          {c.branch !== ctx.runBranch ? (
            <Text style={styles.meta} numberOfLines={1}>
              {c.branch}
            </Text>
          ) : null}
        </View>
        <Text style={styles.dist}>{c.dist}</Text>
      </View>
      <View style={styles.chips}>
        <CellStateChip cell={c} now={ctx.now} />
        {c.testsSkipped && c.state !== 'pending' ? (
          <TipChip
            label="no tests"
            tone="amber"
            tip="Built without «Run tests»: the tree’s suites did not check this image"
          />
        ) : null}
        {c.state === 'pending' && lastBuilt ? <LastBuiltChips entry={lastBuilt} /> : null}
        {c.state === 'done' && c.status === 'SUCCESS' && freshness ? (
          <FreshnessChip freshness={freshness} ticket={ctx.ticket} />
        ) : null}
        <RunTwinChip cell={c} disabled={ctx.busy || retrying} onRetry={ctx.onRetryTwin} />
        <RegistryChip
          cell={c}
          pushing={pushing}
          menuDisabled={ctx.building || ctx.busy}
          onOpenPush={ctx.onOpenPush}
        />
        {c.state === 'done' && testDirs.length > 0 && ctx.baseUrl ? (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`Run the tests of ${testDirs.length} workspace(s) of this image in build-web`}
            onPress={() =>
              openExternalLink(
                `${ctx.baseUrl}/tests?preselect=${encodeURIComponent(testDirs.join(','))}`
              )
            }
          >
            <BuildWebToneChip label={`Tests · ${testDirs.length}`} tone={null} />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.actions}>
        {c.url ? (
          <Text
            style={styles.link}
            accessibilityRole="link"
            onPress={() => {
              if (c.url) {
                ctx.onOpenLog(
                  c.url,
                  `${c.image} (${c.dist})${c.number !== null ? ` #${c.number}` : ''}`
                )
              }
            }}
          >
            console
          </Text>
        ) : null}
        {meta ? (
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
        <View style={styles.grow} />
        {live && !derived ? (
          <BuildTabButton
            variant="ghost"
            icon={CircleStop}
            accessibilityLabel="Cancel this build"
            disabled={cancelling}
            onPress={() => ctx.onCancel(c)}
          />
        ) : null}
        {c.state === 'pending' && !derived ? (
          <BuildTabButton
            variant="ghost"
            icon={Play}
            accessibilityLabel="Build this image — and choose what it publishes"
            disabled={ctx.busy}
            onPress={() => ctx.onOpenBuild([comboOf(c)])}
          />
        ) : null}
        {c.state === 'done' && !derived ? (
          <BuildTabButton
            variant="ghost"
            icon={RotateCw}
            accessibilityLabel="Rebuild — and choose what it publishes"
            disabled={ctx.busy}
            onPress={() => ctx.onOpenBuild([comboOf(c)])}
          />
        ) : null}
        {(c.state === 'pending' || c.state === 'done') && !derived ? (
          <BuildTabButton
            variant="ghost"
            icon={Trash2}
            accessibilityLabel="Remove from list"
            disabled={ctx.building || ctx.busy}
            onPress={() => ctx.onRemove(comboOf(c))}
          />
        ) : null}
      </View>
    </View>
  )
}

export const RunImageRow = memo(RunImageRowView)

const styles = StyleSheet.create({
  row: {
    gap: spacing.xs + 2,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { flex: 1, minWidth: 0 },
  image: { color: colors.textPrimary, fontFamily: typography.monoFamily, fontSize: 13 },
  dist: { color: colors.textMuted, fontSize: typography.metaSize },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs + 2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  grow: { flex: 1 },
  link: {
    color: colors.textSecondary,
    fontSize: typography.metaSize,
    textDecorationLine: 'underline'
  },
  meta: { color: colors.textMuted, fontSize: 11, fontFamily: typography.monoFamily, flexShrink: 1 }
})
