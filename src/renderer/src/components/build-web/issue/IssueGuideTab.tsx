import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { ResizableSplit } from './ResizableSplit'
import type { BuildWebIssueDetail } from '../../../../../shared/build-web-types'
import type { BuildWebRun } from '../../../../../shared/build-web-run-types'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import { callBuildWeb } from '../build-web-client'
import { BuildWebListState } from '../BuildWebListState'
import { withShotUrls } from './issue-card-facts'
import { useShotUrls } from './guide/use-shot-urls'
import { useGuideWriter } from './guide/use-guide-writer'
import { GuideEditor } from './guide/GuideEditor'
import { GuideShotsCard } from './guide/GuideShotsCard'
import { GuidePublishCard } from './guide/GuidePublishCard'
import { GuideJiraPanel } from './guide/GuideJiraPanel'

const messageOf = (failure: unknown) =>
  failure instanceof Error ? failure.message : String(failure)

/** The guide of a task's run, after build-web's Guide: written, illustrated and published. */
function GuideOfRun({
  target,
  detail,
  run,
  canWrite,
  onRun
}: {
  target: RuntimeClientTarget
  detail: BuildWebIssueDetail
  run: BuildWebRun
  canWrite: boolean
  onRun: (run: BuildWebRun) => void
}): React.JSX.Element {
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
    target,
    runId: run.id,
    setGuide,
    onRun,
    onError: setError
  })
  const shots = useShotUrls(target, run.id, streaming ? '' : guide, shotsVersion)
  const jiraKey = detail.jira_key

  // The text is the run's when the run changes, never on a re-read of the same run.
  useEffect(() => {
    setGuide(run.guide_markdown ?? '')
    dirty.current = false
    // eslint-disable-next-line react-hooks/exhaustive-deps -- by run id, as build-web does.
  }, [run.id])

  const store = useCallback(async (): Promise<boolean> => {
    const result = await callBuildWeb(target, 'saveGuide', { runId: run.id, guide })
    if (!result.ok) {
      setError(result.error)
      return false
    }
    if (result.value) {
      onRun(result.value)
    }
    dirty.current = false
    return true
  }, [guide, onRun, run.id, target])

  const save = async () => {
    setError(null)
    try {
      if (await store()) {
        setSaved(true)
        window.setTimeout(() => setSaved(false), 1500)
      }
    } catch (failure) {
      setError(messageOf(failure))
    }
  }

  const refreshImages = async () => {
    setError(null)
    setRefreshing(true)
    try {
      const result = await callBuildWeb(target, 'refreshGuideImages', { runId: run.id, guide })
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
      const result = await callBuildWeb(target, 'publishGuide', { jiraKey, runId: run.id, guide })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setPostResult(result.value)
      const fresh = await callBuildWeb(target, 'getRun', { runId: run.id })
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
    void callBuildWeb(target, 'getRun', { runId: run.id }).then(
      (fresh) => fresh && onRun(fresh),
      () => {}
    )
  }, [onRun, run.id, target])

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <span className="flex-1 whitespace-pre-wrap">{error}</span>
          <button type="button" className="hover:underline" onClick={() => setError(null)}>
            {translate('buildWeb.run.dismiss', 'Dismiss')}
          </button>
        </div>
      ) : null}
      <ResizableSplit
        panel="guide"
        side="right"
        defaultWidth={380}
        minWidth={300}
        aside={
          <aside className="flex min-w-0 flex-col gap-3">
            <GuideShotsCard
              target={target}
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
            {jiraKey ? (
              <GuideJiraPanel target={target} jiraKey={jiraKey} canWrite={canWrite} />
            ) : null}
          </aside>
        }
      >
        <GuideEditor
          guide={guide}
          preview={withShotUrls(
            guide,
            shots.urls,
            shots.missing,
            translate('buildWeb.guide.frameMissing', 'frame not taken')
          )}
          note={translate(
            'buildWeb.guide.note',
            'From the task’s build. A saved guide is written to the {{key}} card as a comment.',
            { key: detail.key }
          )}
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
      </ResizableSplit>
    </div>
  )
}

export function IssueGuideTab({
  target,
  detail,
  run,
  error,
  canWrite,
  onRun,
  onOpenBuild
}: {
  target: RuntimeClientTarget
  detail: BuildWebIssueDetail
  run: BuildWebRun | null | undefined
  error: string | null
  canWrite: boolean
  onRun: (run: BuildWebRun | null) => void
  onOpenBuild: () => void
}): React.JSX.Element {
  if (error) {
    return <BuildWebListState kind="error" error={error} />
  }
  if (run === undefined) {
    return (
      <BuildWebListState
        kind="loading"
        loadingLabel={translate('buildWeb.state.loadingCard', 'Loading…')}
      />
    )
  }
  if (run === null) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col items-start gap-3 rounded-lg border border-dashed border-border bg-card p-8">
        <p className="text-sm font-semibold">
          {translate('buildWeb.guide.noneYet', 'No guide yet')}
        </p>
        <p className="text-sm text-muted-foreground">
          {translate(
            'buildWeb.guide.needsBuild',
            'The guide is written from the task’s build: what changed, how to check it and which images are built. Make the build first.'
          )}
        </p>
        <Button size="sm" onClick={onOpenBuild}>
          {translate('buildWeb.guide.toBuild', 'To the build')}
        </Button>
      </div>
    )
  }
  return (
    <GuideOfRun
      key={run.id}
      target={target}
      detail={detail}
      run={run}
      canWrite={canWrite}
      onRun={onRun}
    />
  )
}
