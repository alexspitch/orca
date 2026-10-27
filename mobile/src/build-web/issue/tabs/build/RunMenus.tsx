import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type {
  BuildWebCombo,
  BuildWebPushAfter
} from '../../../../../../src/shared/build-web-run-types'
import {
  testsChoice,
  type Cell
} from '../../../../../../src/renderer/src/components/build-web/issue/build/run-cells'
import { BottomDrawer } from '../../../../components/BottomDrawer'
import { MobileSwitch } from '../../../../components/MobileSwitch'
import { colors, spacing, typography } from '../../../../theme/mobile-theme'

// build-web's two menus, as sheets: what a build publishes once it lands, chosen when it is
// started, and what a push publishes.

export type RunMenu =
  | { kind: 'build'; combos: BuildWebCombo[] }
  | { kind: 'push'; cells: Cell[] }
  | null

const BUILD_OPTIONS: { pushAfter: BuildWebPushAfter; title: string; hint: string }[] = [
  {
    pushAfter: 'none',
    title: 'Build, don’t push',
    hint: 'the image stays on the build server'
  },
  {
    pushAfter: 'build-tag',
    title: 'Build + push build tag',
    hint: 'publishes <ver>bNNNN only; the moving tag stays where it is'
  },
  {
    pushAfter: 'all',
    title: 'Build + push all tags',
    hint: 'also moves <ver> — the tag guard still refuses to move it backwards'
  }
]

function MenuLine({ title, hint, onPress }: { title: string; hint?: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.line, pressed ? styles.pressed : null]}
    >
      <Text style={styles.title}>{title}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </Pressable>
  )
}

export function RunMenuSheet({
  menu,
  treeBranches,
  onBuild,
  onPush,
  onClose
}: {
  menu: RunMenu
  treeBranches: ReadonlySet<string>
  onBuild: (combos: BuildWebCombo[], pushAfter: BuildWebPushAfter, skipTests: boolean) => void
  onPush: (cells: Cell[], moveMainTag: boolean) => void
  onClose: () => void
}) {
  // «Run tests» is off again every time the menu closes, as in build-web.
  const [runTests, setRunTests] = useState(false)
  const close = () => {
    setRunTests(false)
    onClose()
  }
  const combos = menu?.kind === 'build' ? menu.combos : []
  const tests = testsChoice(
    combos.map((c) => c.branch),
    treeBranches,
    runTests
  )
  const cells = menu?.kind === 'push' ? menu.cells : []
  const allPushed = cells.every((c) => c.pushed)
  return (
    <BottomDrawer visible={menu !== null} onClose={close}>
      {menu?.kind === 'build' ? (
        <View>
          <Text style={styles.heading}>
            Build {combos.length === 1 ? combos[0]?.image : `${combos.length} images`}
          </Text>
          <View style={styles.switchRow}>
            <View style={styles.switchText}>
              <Text style={styles.title}>Run tests</Text>
              <Text style={styles.hint}>
                {tests.forced
                  ? 'Jenkins runs this build, and it always runs the tests'
                  : 'off, a build from the tree (master) goes without the offline suites'}
              </Text>
            </View>
            <MobileSwitch
              value={!tests.skipTests}
              disabled={tests.forced}
              onValueChange={setRunTests}
              accessibilityLabel="Run tests"
            />
          </View>
          {BUILD_OPTIONS.map((o) => (
            <MenuLine
              key={o.pushAfter}
              title={o.title}
              hint={o.hint}
              onPress={() => {
                close()
                onBuild(combos, o.pushAfter, tests.skipTests)
              }}
            />
          ))}
        </View>
      ) : null}
      {menu?.kind === 'push' ? (
        <View>
          <Text style={styles.heading}>
            Publish {cells.length === 1 ? cells[0]?.image : `${cells.length} images`}
          </Text>
          {allPushed ? null : (
            <MenuLine
              title="Push build tag only"
              onPress={() => {
                onClose()
                onPush(cells, false)
              }}
            />
          )}
          <MenuLine
            title={allPushed ? 'Push main tag' : 'Push main + build tag'}
            onPress={() => {
              onClose()
              onPush(cells, true)
            }}
          />
        </View>
      ) : null}
    </BottomDrawer>
  )
}

const styles = StyleSheet.create({
  heading: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm
  },
  line: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: 2 },
  pressed: { backgroundColor: colors.bgRaised },
  title: { color: colors.textPrimary, fontSize: typography.bodySize },
  hint: { color: colors.textMuted, fontSize: typography.metaSize },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle
  },
  switchText: { flex: 1, gap: 2 }
})
