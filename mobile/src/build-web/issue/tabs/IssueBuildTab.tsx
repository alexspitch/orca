import { useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { repoOfProduct } from '../../../../../src/shared/build-web-repos'
import { runDistOf } from '../../../../../src/shared/build-web-redos-twin'
import { useDistRules } from '../../use-dist-rules'
import { LoadingSpinner } from '../../../components/LoadingSpinner'
import { MobileLoadErrorState } from '../../../components/MobileLoadErrorState'
import { colors, spacing } from '../../../theme/mobile-theme'
import { loginOf } from '../../build-web-labels'
import type { BuildWebIssueTabProps } from '../../build-web-card-tabs'
import { useBuildWebScreen } from '../../build-web-screen-context'
import { BuildWebToneChip } from '../../BuildWebToneChip'
import { buildTabText } from './build/BuildTabControls'
import { IssueNewBuild } from './build/IssueNewBuild'
import { IssueRunProgress } from './build/IssueRunProgress'

const SETTLED = new Set(['success', 'failed', 'partial', 'pending'])

/**
 * The task's «Build» tab, after build-web's IssueBuilds. A task has one run: without it the tab
 * looks for images already built after the task's last commit, then offers the form that makes
 * the run; with it, the run's own build screen.
 */
export function IssueBuildTab({
  detail,
  run,
  runError,
  reloadRun,
  canWrite,
  testing
}: BuildWebIssueTabProps) {
  const { call } = useBuildWebScreen()
  const rules = useDistRules()
  const [adopt, setAdopt] = useState<'busy' | 'none' | null>(null)
  const adoptedFor = useRef<string | null>(null)

  // Once per task without a run: the console makes one only when something is already built.
  useEffect(() => {
    if (run !== null || runError || !canWrite || adoptedFor.current === detail.id) {
      return
    }
    adoptedFor.current = detail.id
    setAdopt('busy')
    call('adoptBuilt', { id: detail.id, testingStatus: testing })
      .then((result) => {
        if (result.ok && result.value.run) {
          reloadRun()
        }
        // Why even after a re-run of this effect: it asks once per task, so only this answer settles it.
        setAdopt(
          result.ok && !result.value.run && result.value.reason === 'none built' ? 'none' : null
        )
      })
      .catch(() => setAdopt(null))
  }, [call, canWrite, detail.id, reloadRun, run, runError, testing])

  if (runError) {
    return <MobileLoadErrorState message={runError} onRetry={reloadRun} />
  }
  if (run === undefined) {
    return <LoadingSpinner size={18} color={colors.textMuted} />
  }
  // Why an empty run too: with every image removed there is nothing to detect from, so it starts
  // over as the form; what it creates is added to that run.
  if (run === null || run.builds.length === 0) {
    if (!canWrite) {
      return (
        <Text style={buildTabText.muted}>
          The task has no build yet, and you have no right to build.
        </Text>
      )
    }
    return (
      <View style={styles.column}>
        {adopt ? (
          <View style={styles.row}>
            {adopt === 'busy' ? <LoadingSpinner size={14} color={colors.textMuted} /> : null}
            <Text style={buildTabText.muted}>
              {adopt === 'busy'
                ? 'Looking for images already built after the task’s last commit…'
                : 'No images were built after the task’s last commit.'}
            </Text>
          </View>
        ) : null}
        <IssueNewBuild
          // Why the branch: another release starts the form over, from its own branch.
          key={`${detail.id}|${detail.branches[0] ?? 'master'}`}
          issue={{
            id: detail.id,
            key: detail.key,
            branch: detail.branches[0] ?? 'master',
            repo: repoOfProduct(detail.product)
          }}
          testing={testing}
          onStarted={reloadRun}
        />
      </View>
    )
  }
  const dist = runDistOf(run, rules)
  return (
    <View style={styles.column}>
      <View style={styles.row}>
        <Text style={buildTabText.heading}>Build</Text>
        <BuildWebToneChip label={run.branch} tone={null} mono />
        <BuildWebToneChip label={dist === 'both' ? 'rhel + redos' : dist} tone={null} />
        <Text style={buildTabText.muted}>
          {loginOf(run.user)} · {new Date(run.created_at).toLocaleString()}
        </Text>
      </View>
      <IssueRunProgress
        key={run.id}
        run={run}
        canWrite={canWrite}
        onStatus={(status) => {
          if (SETTLED.has(status)) {
            reloadRun()
          }
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  column: { gap: spacing.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm }
})
