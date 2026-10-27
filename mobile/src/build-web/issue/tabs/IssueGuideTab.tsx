import { useCallback, useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import type { BuildWebIssueDetail } from '../../../../../src/shared/build-web-types'
import type { BuildWebRun } from '../../../../../src/shared/build-web-run-types'
import { withShotUrls } from '../../../../../src/renderer/src/components/build-web/issue/issue-card-facts'
import { LoadingSpinner } from '../../../components/LoadingSpinner'
import { MobileLoadErrorState } from '../../../components/MobileLoadErrorState'
import { colors, radii, spacing, typography } from '../../../theme/mobile-theme'
import type { BuildWebIssueTabProps } from '../../build-web-card-tabs'
import { useBuildWebScreen } from '../../build-web-screen-context'
import { CardButton } from '../issue-card-ui'
import { BuildTabError } from './build/BuildTabControls'
import { messageOf } from './guide/guide-failure'
import { GuideEditor } from './guide/GuideEditor'
import { GuideJiraPanel } from './guide/GuideJiraPanel'
import { GuidePublishCard } from './guide/GuidePublishCard'
import { GuideShotsCard } from './guide/GuideShotsCard'
import { useGuideWriter } from './guide/use-guide-writer'
import { useShotUrls } from './guide/use-shot-urls'

/** The guide of a task's run, after build-web's Guide: written, illustrated and published. */
function GuideOfRun({
  detail,
  run,
  canWrite,
  onRun
}: {
  detail: BuildWebIssueDetail
  run: BuildWebRun
  canWrite: boolean
  onRun: (run: BuildWebRun) => void
}) {
  const { call } = useBuildWebScreen()
  const [guide, setGuide] = useState(run.guide_markdown ?? '')
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [saved, setSaved] = useState(false)
  const [posting, setPosting] = useState(false)
  const [postResult, setPostResult] = useState<{ action: string; url: string } | null>(null)
  const [shotsVersion, setShotsVersion] = useState(0)
  // Edits not stored on the run yet; the screenshot job and a publish read the stored guide.
  const dirty = useRef(false)
  const { streaming, write } = useGuideWriter({
    runId: run.id,
    setGuide,
    onRun,
    onError: setError
  })
  const shots = useShotUrls(run.id, streaming ? '' : guide, shotsVersion)
  const jiraKey = detail.jira_key

  // The text is the run's when the run changes, never on a re-read of the same run.
  useEffect(() => {
    setGuide(run.guide_markdown ?? '')
    dirty.current = false
  }, [run.id])

  const store = useCallback(async (): Promise<boolean> => {
    const result = await call('saveGuide', { runId: run.id, guide })
    if (!result.ok) {
      setError(result.error)
      return false
    }
    if (result.value) {
      onRun(result.value)
    }
    dirty.current = false
    return true
  }, [call, guide, onRun, run.id])

  const save = async () => {
    setError(null)
    try {
      if (await store()) {
        setSaved(true)
        setTimeout(() => setSaved(false), 1500)
      }
    } catch (failure) {
      setError(messageOf(failure))
    }
  }

  const refreshImages = async () => {
    setError(null)
    setRefreshing(true)
    try {
      const result = await call('refreshGuideImages', { runId: run.id, guide })
      if (result.ok && result.value) {
        setGuide(result.value.guide_markdown ?? '')
        dirty.current = false
        onRun(result.value)
      } else if (!result.ok) {
        setError(result.error)
      }
    } catch (failure) {
      setError(messageOf(failure))
    } finally {
      setRefreshing(false)
    }
  }

  const publish = async () => {
    if (!jiraKey) {
      return
    }
    setPosting(true)
    setError(null)
    try {
      if (dirty.current && !(await store())) {
        return
      }
      const result = await call('publishGuide', { jiraKey, runId: run.id, guide })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setPostResult(result.value)
      const fresh = await call('getRun', { runId: run.id })
      if (fresh) {
        onRun(fresh)
      }
    } catch (failure) {
      setError(messageOf(failure))
    } finally {
      setPosting(false)
    }
  }

  const onShotsTaken = useCallback(() => {
    setShotsVersion((v) => v + 1)
    void call('getRun', { runId: run.id }).then(
      (fresh) => fresh && onRun(fresh),
      () => {}
    )
  }, [call, onRun, run.id])

  return (
    <View style={styles.column}>
      {error ? <BuildTabError message={error} onDismiss={() => setError(null)} /> : null}
      <GuideEditor
        guide={guide}
        preview={withShotUrls(guide, shots.urls, shots.missing, 'frame not taken')}
        sources={shots.sources}
        note={`From the task’s build. A saved guide is written to the ${detail.key} card as a comment.`}
        hasTicket={Boolean(run.ticket)}
        hasBuild={run.builds.some((b) => b.status === 'SUCCESS')}
        canWrite={canWrite}
        streaming={streaming}
        refreshing={refreshing}
        saved={saved}
        onEdit={(text) => {
          setGuide(text)
          dirty.current = true
        }}
        onGenerate={() => void write()}
        onRefreshImages={() => void refreshImages()}
        onSave={() => void save()}
        onRevise={(feedback) => void write(feedback, guide)}
      />
      <GuideShotsCard
        run={run}
        hasGuide={Boolean(guide)}
        disabled={streaming || !canWrite}
        onRun={onRun}
        beforeShoot={async () => !dirty.current || store()}
        onShotsTaken={onShotsTaken}
        onError={setError}
      />
      <GuidePublishCard
        run={run}
        jiraKey={jiraKey}
        hasGuide={Boolean(guide) && canWrite}
        posting={posting}
        result={postResult}
        onPublish={() => void publish()}
      />
      {jiraKey ? <GuideJiraPanel jiraKey={jiraKey} canWrite={canWrite} /> : null}
    </View>
  )
}

export function IssueGuideTab({
  detail,
  run,
  runError,
  canWrite,
  setRun,
  openTab
}: BuildWebIssueTabProps) {
  if (runError) {
    return <MobileLoadErrorState message={runError} />
  }
  if (run === undefined) {
    return <LoadingSpinner size={18} color={colors.textMuted} />
  }
  if (run === null) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>No guide yet</Text>
        <Text style={styles.emptyText}>
          The guide is written from the task’s build: what changed, how to check it and which images
          are built. Make the build first.
        </Text>
        <CardButton variant="primary" label="To the build" onPress={() => openTab('build')} />
      </View>
    )
  }
  return <GuideOfRun key={run.id} detail={detail} run={run} canWrite={canWrite} onRun={setRun} />
}

const styles = StyleSheet.create({
  column: { gap: spacing.md },
  empty: {
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: radii.card,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgPanel
  },
  emptyTitle: { color: colors.textPrimary, fontSize: typography.bodySize, fontWeight: '600' },
  emptyText: { color: colors.textMuted, fontSize: typography.bodySize }
})
