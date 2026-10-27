import { StyleSheet, Text, View } from 'react-native'
import { RefreshCw, Search, TriangleAlert } from 'lucide-react-native'
import type { BuildWebTestingStatus } from '../../../../../../src/shared/build-web-run-types'
import { chipTones, colors, radii, spacing, typography } from '../../../../theme/mobile-theme'
import { ImagePicker, SelectField } from './BuildPickers'
import { BuildTabButton, BuildTabError, BuildTabSection, buildTabText } from './BuildTabControls'
import { NewBuildRows, ReadOnlyField, ReleaseBranchSheet, Step, testingNote } from './NewBuildParts'
import { useNewBuild, type NewBuildIssue } from './use-new-build'

export function IssueNewBuild({
  issue,
  testing,
  onStarted
}: {
  issue: NewBuildIssue
  testing: BuildWebTestingStatus
  onStarted: () => void
}) {
  const form = useNewBuild(issue, testing, onStarted)
  const { detect, busy, branch } = form
  return (
    <View style={styles.column}>
      {form.releaseBranches ? (
        <ReleaseBranchSheet
          visible={form.askingVersions}
          branches={form.releaseBranches}
          off={form.offBranches}
          onChange={form.setOffBranches}
          onCancel={() => form.setAskingVersions(false)}
          onCreate={() => {
            form.setAskingVersions(false)
            void form.create()
          }}
        />
      ) : null}
      {form.error ? <BuildTabError message={form.error} /> : null}
      <BuildTabSection>
        <Step n={1} on title="Where to build from" />
        <View style={styles.fieldBlock}>
          <Text style={buildTabText.muted}>
            Branch{' '}
            <Text style={styles.accent}>
              · {branch === form.releaseBranch ? 'from the task’s release' : 'chosen by hand'}
            </Text>
          </Text>
          <SelectField
            title="Branch"
            value={branch}
            options={form.branchOptions}
            onChange={form.pickBranch}
            mono
          />
        </View>
        <ReadOnlyField label="Task" value={issue.key} />
        <View style={styles.buttons}>
          <BuildTabButton
            label="Fetch"
            variant="ghost"
            icon={RefreshCw}
            loading={busy === 'fetch'}
            onPress={() => void form.fetchBranches()}
          />
          <BuildTabButton
            label={detect ? 'Find again' : 'Find images'}
            variant="primary"
            icon={Search}
            disabled={!branch}
            loading={busy === 'detect'}
            onPress={() => void form.runDetect()}
            style={styles.flex}
          />
        </View>
        <Text style={buildTabText.muted}>{testingNote(testing)}</Text>
      </BuildTabSection>
      <BuildTabSection>
        <Step n={2} on={Boolean(detect)} title="Images" />
        {detect ? (
          <Text style={buildTabText.muted}>
            {detect.ticket ?? issue.key} · {detect.commit_count} commit(s) in {detect.branch}
          </Text>
        ) : null}
        {detect ? (
          <>
            <Text style={buildTabText.muted}>
              {form.chosen.length
                ? `Images chosen: ${form.chosen.length} · rhel and redos — ${form.chosen.length * 2} builds. Builds do not start by themselves: they are started on the next step.`
                : 'Tick images or add one by hand.'}
            </Text>
            <BuildTabButton
              label={busy === 'start' ? 'Creating…' : 'Create build'}
              variant="primary"
              disabled={!form.chosen.length || busy === 'start'}
              onPress={form.requestCreate}
            />
            <NewBuildRows rows={form.rows} off={form.off} branch={branch} onToggle={form.toggle} />
            {detect.plugins_changed.length > 0 ? (
              <View style={styles.warning}>
                <TriangleAlert size={14} color={chipTones.amber} />
                <Text style={styles.warningText}>
                  Plugin changes pull in the sa-backend image: {detect.plugins_changed.join(', ')}.
                </Text>
              </View>
            ) : null}
            {detect.ignored_shared.length > 0 ? (
              <Text style={buildTabText.muted}>
                Shared code changed: {detect.ignored_shared.join(', ')}.
              </Text>
            ) : null}
            <View style={styles.addBlock}>
              <Text style={buildTabText.muted}>Add any image</Text>
              <ImagePicker images={form.extras} value={form.choice} onChange={form.setChoice} />
              <SelectField
                title="Branch"
                value={form.addBranch}
                options={form.branchOptions}
                onChange={form.pickAddBranch}
                mono
              />
              <BuildTabButton label="Add" disabled={!form.choice} onPress={form.addManual} />
            </View>
          </>
        ) : (
          <View style={styles.empty}>
            <Text style={buildTabText.heading}>No images found yet</Text>
            <Text style={[buildTabText.muted, styles.center]}>
              The console compares the task’s commits with the branch and offers the images they
              touch. Any other image can be added by hand.
            </Text>
            <BuildTabButton
              label="Find images"
              variant="primary"
              disabled={!branch || busy === 'detect'}
              onPress={() => void form.runDetect()}
            />
          </View>
        )}
      </BuildTabSection>
    </View>
  )
}

const styles = StyleSheet.create({
  column: { gap: spacing.md },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  fieldBlock: { gap: spacing.xs + 2 },
  accent: { color: colors.accentBlue },
  buttons: { flexDirection: 'row', gap: spacing.sm },
  warning: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm + 2,
    borderRadius: radii.row,
    backgroundColor: `${chipTones.amber}26`
  },
  warningText: { flex: 1, color: chipTones.amber, fontSize: typography.metaSize },
  addBlock: {
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSubtle
  },
  empty: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
    borderRadius: radii.row,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderSubtle
  }
})
