import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type {
  BuildWebIssueBuildBranch,
  BuildWebTestingStatus
} from '../../../../../../src/shared/build-web-run-types'
import type { ChipTone } from '../../../../../../src/renderer/src/components/build-web/build-web-tones'
import { BottomDrawer } from '../../../../components/BottomDrawer'
import { colors, radii, spacing, typography } from '../../../../theme/mobile-theme'
import { BuildWebToneChip } from '../../../BuildWebToneChip'
import { BuildTabButton, BuildTabTick, buildTabText } from './BuildTabControls'

// The pieces of a task's first-build form: its steps, its read-only fields, the image and branch rows.

export type Origin = 'found' | 'suggested' | 'manual'
export type Row = { image: string; branch: string; why: string; origin: Origin }
export const rowKey = (r: { image: string; branch: string }) => `${r.image}|${r.branch}`

const ORIGIN_CHIPS: Record<Origin, { label: string; tone: ChipTone | null }> = {
  found: { label: 'found', tone: 'blue' },
  suggested: { label: 'suggested', tone: 'sky' },
  manual: { label: 'manual', tone: null }
}

export function testingNote(testing: BuildWebTestingStatus): string {
  switch (testing) {
    case 'Testing':
      return 'Testing: images are not published; the watcher publishes them when the task reaches Done.'
    case 'TESTING_EXTERNAL':
      return 'TESTING_EXTERNAL: the build tag is published right after the build.'
    case 'Done':
      return 'Done: the train moves the task straight to Done and publishes every image, main tag included.'
  }
}

export function Step({
  n,
  on,
  title,
  children
}: {
  n: number
  on: boolean
  title: string
  children?: ReactNode
}) {
  return (
    <View style={styles.step}>
      <View style={[styles.stepDot, on && styles.stepDotOn]}>
        <Text style={[styles.stepNumber, on && styles.stepNumberOn]}>{n}</Text>
      </View>
      <Text style={[buildTabText.heading, styles.flex]}>{title}</Text>
      {children}
    </View>
  )
}

export function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={buildTabText.muted}>{label}</Text>
      <View style={styles.readOnly}>
        <Text numberOfLines={1} style={buildTabText.mono}>
          {value}
        </Text>
      </View>
    </View>
  )
}

/** The images the form offers, each ticked or not; a tap anywhere on the row toggles it. */
export function NewBuildRows({
  rows,
  off,
  branch,
  onToggle
}: {
  rows: Row[]
  off: ReadonlySet<string>
  branch: string
  onToggle: (key: string, on: boolean) => void
}) {
  if (rows.length === 0) {
    return (
      <Text style={buildTabText.muted}>
        The task’s commits touch no image — add the one you need by hand.
      </Text>
    )
  }
  return (
    <View style={styles.list}>
      {rows.map((r, i) => {
        const key = rowKey(r)
        const on = !off.has(key)
        const chip = ORIGIN_CHIPS[r.origin]
        return (
          <Pressable
            key={key}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            onPress={() => onToggle(key, !on)}
            style={[styles.row, i > 0 && styles.rowBorder, !on && styles.rowOff]}
          >
            <BuildTabTick
              checked={on}
              onPress={() => onToggle(key, !on)}
              accessibilityLabel={r.image}
            />
            <View style={styles.rowBody}>
              <Text style={buildTabText.mono}>
                {r.image}
                {r.branch !== branch ? <Text style={buildTabText.muted}> · {r.branch}</Text> : null}
              </Text>
              <Text numberOfLines={2} style={buildTabText.small}>
                {r.why}
              </Text>
            </View>
            <BuildWebToneChip label={chip.label} tone={chip.tone} />
          </Pressable>
        )
      })}
    </View>
  )
}

/** The release branches the build reaches; the release's own is always built, the rest may be left out. */
function ReleaseBranchRows({
  branches,
  off,
  onToggle
}: {
  branches: readonly BuildWebIssueBuildBranch[]
  off: ReadonlySet<string>
  onToggle: (branch: string, on: boolean) => void
}) {
  return (
    <View style={styles.list}>
      {branches.map((b, i) => {
        const on = b.primary || !off.has(b.branch)
        return (
          <Pressable
            key={b.branch}
            disabled={b.primary}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on, disabled: b.primary }}
            onPress={() => onToggle(b.branch, !on)}
            style={[styles.row, i > 0 && styles.rowBorder, !on && styles.rowOff]}
          >
            <BuildTabTick
              checked={on}
              disabled={b.primary}
              onPress={() => onToggle(b.branch, !on)}
              accessibilityLabel={b.branch}
            />
            <View style={styles.rowBody}>
              <Text style={buildTabText.mono}>{b.branch}</Text>
              {!b.primary && !b.has_commits ? (
                <Text style={buildTabText.small}>no commits yet — added when they arrive</Text>
              ) : null}
            </View>
            {b.primary ? <BuildWebToneChip label="task’s release" tone="blue" /> : null}
            {b.on_run ? <BuildWebToneChip label="already built" tone={null} /> : null}
          </Pressable>
        )
      })}
    </View>
  )
}

/** Asked on «Create build» when the task reaches more than one version: which ones to build for. */
export function ReleaseBranchSheet({
  visible,
  branches,
  off,
  onChange,
  onCreate,
  onCancel
}: {
  visible: boolean
  branches: readonly BuildWebIssueBuildBranch[]
  off: ReadonlySet<string>
  onChange: (off: ReadonlySet<string>) => void
  onCreate: () => void
  onCancel: () => void
}) {
  return (
    <BottomDrawer visible={visible} onClose={onCancel}>
      <View style={styles.sheet}>
        <Text style={buildTabText.heading}>Which versions to build for?</Text>
        <Text style={buildTabText.muted}>
          Versions the images are built for: the task’s release, and each newer one its commits
          reach. Untick one to leave it out of this task’s builds.
        </Text>
        {branches.length >= 2 ? (
          <ReleaseBranchRows
            branches={branches}
            off={off}
            onToggle={(name, on) => {
              const next = new Set(off)
              if (on) {
                next.delete(name)
              } else {
                next.add(name)
              }
              onChange(next)
            }}
          />
        ) : null}
        <View style={styles.buttons}>
          <BuildTabButton label="Cancel" onPress={onCancel} style={styles.flex} />
          <BuildTabButton
            label="Create build"
            variant="primary"
            onPress={onCreate}
            style={styles.flex}
          />
        </View>
      </View>
    </BottomDrawer>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  step: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2, flexWrap: 'wrap' },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgRaised
  },
  stepDotOn: { backgroundColor: colors.textPrimary },
  stepNumber: { fontSize: typography.metaSize, fontWeight: '600', color: colors.textMuted },
  stepNumberOn: { color: colors.bgBase },
  fieldBlock: { gap: spacing.xs + 2, minWidth: 0 },
  readOnly: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgRaised
  },
  list: {
    borderRadius: radii.row,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: 'hidden'
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderSubtle },
  rowOff: { backgroundColor: colors.bgBase },
  rowBody: { flex: 1, minWidth: 0, gap: 2 },
  sheet: { gap: spacing.md, paddingHorizontal: spacing.xs, paddingBottom: spacing.md },
  buttons: { flexDirection: 'row', gap: spacing.sm }
})
