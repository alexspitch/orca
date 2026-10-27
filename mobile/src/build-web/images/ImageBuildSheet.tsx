import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import type { BuildWebImageBuildArgs } from '../../../../src/shared/build-web-image-types'
import { versionOfBranch } from '../../../../src/shared/build-web-image-tracking'
import { repoOfImage } from '../../../../src/shared/build-web-repos'
import { useDistRules } from '../use-dist-rules'
import { testsChoice } from '../../../../src/renderer/src/components/build-web/issue/build/run-cells'
import { BottomDrawer } from '../../components/BottomDrawer'
import { MobileSegmentedControl } from '../../components/MobileSegmentedControl'
import { MobileSwitch } from '../../components/MobileSwitch'
import { colors, spacing, typography } from '../../theme/mobile-theme'
import { buildWebErrorMessage } from '../build-web-operations'
import { useBuildWebScreen } from '../build-web-screen-context'
import { CardButton, ErrorText, ui } from '../issue/issue-card-ui'
import { SelectField } from '../issue/tabs/build/BuildPickers'
import { useImageTracking } from './image-tracking'

/** What the build sheet opens with: the picked images, their product, and their common branch. */
export type ImageBuildChoice = { images: string[]; product: string; branch?: string }

type Dist = BuildWebImageBuildArgs['dist']
const DISTS: { value: Dist; label: string }[] = [
  { value: 'both', label: 'rhel and redos' },
  { value: 'rhel', label: 'rhel' },
  { value: 'redos', label: 'redos' }
]

/** Images to a new build on a version (a branch) of their product, as build-web's «Собрать…». */
export function ImageBuildSheet({
  choice,
  onClose
}: {
  choice: ImageBuildChoice | null
  onClose: () => void
}) {
  return (
    <BottomDrawer visible={choice !== null} onClose={onClose}>
      {/* Why keyed: versions and the form start fresh with every opening. */}
      {choice ? (
        <BuildForm key={choice.images.join('|')} choice={choice} onClose={onClose} />
      ) : null}
    </BottomDrawer>
  )
}

function BuildForm({ choice, onClose }: { choice: ImageBuildChoice; onClose: () => void }) {
  const { call, notify } = useBuildWebScreen()
  const rules = useDistRules()
  const { trackBuild } = useImageTracking()
  const { images, product, branch: initialBranch } = choice
  const [branches, setBranches] = useState<string[] | null>(null)
  const [branch, setBranch] = useState('')
  const [dist, setDist] = useState<Dist>('both')
  const [ticket, setTicket] = useState('')
  // Off by default: a build from the tree goes without the offline suites unless asked.
  const [runTests, setRunTests] = useState(false)
  // Empty until read (or on an older host): every build then runs the tests, as Jenkins does.
  const [treeBranches, setTreeBranches] = useState<ReadonlySet<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    call('versionBranches', { product }).then(
      (offered) => {
        if (alive) {
          // Why keep a branch outside the list: «build again» names the one the last build used.
          const list =
            initialBranch && !offered.includes(initialBranch)
              ? [initialBranch, ...offered]
              : offered
          setBranches(list)
          setBranch(initialBranch || list[0] || '')
        }
      },
      (failure: unknown) => {
        if (alive) {
          setBranches([])
          setError(buildWebErrorMessage(failure))
        }
      }
    )
    call('branches').then(
      (list) => {
        if (alive) {
          setTreeBranches(new Set(list.filter((b) => b.fromTree).map((b) => b.name)))
        }
      },
      () => undefined
    )
    return () => {
      alive = false
    }
  }, [call, initialBranch, product])
  const tests = testsChoice(branch ? [branch] : [], treeBranches, runTests)
  // Why: the monorepo builds rhel only — its redos comes with publication (IS-230).
  const choosing = images.length > 0 && rules.choosesDist(repoOfImage(images[0] ?? ''))

  const start = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const args = {
        branch,
        dist: choosing ? dist : 'rhel',
        ...(ticket.trim() ? { ticket: ticket.trim() } : {}),
        ...(tests.skipTests ? { skipTests: true } : {})
      }
      // Why one image the old way: a server without group builds still builds a single image.
      const [only] = images
      const result =
        images.length === 1 && only
          ? await call('startImageBuild', { ...args, image: only })
          : await call('startImageGroupBuild', { ...args, images })
      if (!result.ok) {
        setError(result.error)
        return
      }
      trackBuild({ runId: result.value.runId, images, startedAt: Date.now() })
      // Why one notice: the phone shows one at a time, so the console's note rides along.
      const started = `Build of ${images.length === 1 ? only : `${images.length} images`} started.`
      notify(result.value.note ? `${started} ${result.value.note}` : started, 'success')
      onClose()
    } catch (failure) {
      setError(buildWebErrorMessage(failure))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
      <Text style={styles.heading}>
        {images.length === 1 ? 'Build the image' : `Build ${images.length} images`}
      </Text>
      <View style={styles.images}>
        {images.map((image) => (
          <Text key={image} style={styles.mono} numberOfLines={1}>
            {image}
          </Text>
        ))}
      </View>
      <View style={styles.field}>
        <Text style={ui.muted}>Version</Text>
        <SelectField
          title="Version"
          value={branch}
          options={branches ?? []}
          labelOf={versionOfBranch}
          placeholder={branches === null ? 'Loading versions…' : 'No versions'}
          disabled={!branches?.length}
          onChange={setBranch}
        />
        {branch ? <Text style={ui.muted}>Branch {branch}</Text> : null}
      </View>
      {choosing ? (
        <View style={styles.field}>
          <Text style={ui.muted}>Distribution</Text>
          <MobileSegmentedControl segments={DISTS} selected={dist} onSelect={setDist} fill />
        </View>
      ) : null}
      <View style={styles.field}>
        <Text style={ui.muted}>Ticket (optional)</Text>
        <TextInput
          value={ticket}
          onChangeText={setTicket}
          placeholder="SDAP-1234"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="characters"
          autoCorrect={false}
          accessibilityLabel="Ticket"
          style={ui.input}
        />
      </View>
      <View style={styles.switchRow}>
        <View style={styles.switchText}>
          <Text style={styles.title}>Run tests</Text>
          <Text style={ui.muted}>
            {tests.forced
              ? 'Jenkins runs this build, and it always runs the tests'
              : 'off, the build goes without the offline suites'}
          </Text>
        </View>
        <MobileSwitch
          value={!tests.skipTests}
          disabled={tests.forced || !branch}
          onValueChange={setRunTests}
          accessibilityLabel="Run tests"
        />
      </View>
      {error ? <ErrorText>{error}</ErrorText> : null}
      <View style={styles.actions}>
        <CardButton label="Cancel" variant="ghost" onPress={onClose} />
        <CardButton
          label={busy ? 'Starting…' : 'Start the build'}
          variant="primary"
          disabled={!branch || busy}
          onPress={() => void start()}
        />
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  form: { gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  heading: { color: colors.textPrimary, fontSize: 16, fontWeight: '600' },
  images: { gap: 2 },
  mono: {
    color: colors.textSecondary,
    fontFamily: typography.monoFamily,
    fontSize: typography.metaSize
  },
  field: { gap: spacing.xs },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  switchText: { flex: 1, gap: 2 },
  title: { color: colors.textPrimary, fontSize: typography.bodySize },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm }
})
