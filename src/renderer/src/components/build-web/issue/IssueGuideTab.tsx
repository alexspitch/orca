import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import CommentMarkdown from '@/components/sidebar/CommentMarkdown'
import { useConfirmationDialog } from '@/components/confirmation-dialog-context'
import { translate } from '@/i18n/i18n'
import type { BuildWebIssueDetail } from '../../../../../shared/build-web-types'
import type { BuildWebRun } from '../../../../../shared/build-web-run-types'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import { callBuildWeb } from '../build-web-client'
import { BuildWebListState } from '../BuildWebListState'
import { JiraStatusLine } from '../BuildWebToneChip'
import { guideShotSlugs, withShotUrls } from './issue-card-facts'

/** Screenshot blobs for the guide, fetched with the token in main; revoked when the guide changes. */
function useShotUrls(
  target: RuntimeClientTarget,
  runId: string,
  markdown: string
): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const slugsKey = guideShotSlugs(markdown).join('|')
  useEffect(() => {
    let alive = true
    const made: string[] = []
    void (async () => {
      const next: Record<string, string> = {}
      for (const slug of slugsKey ? slugsKey.split('|') : []) {
        const shot = await callBuildWeb(target, 'guideShot', { runId, slug }).catch(() => null)
        if (shot && alive) {
          const bytes = Uint8Array.from(atob(shot.base64), (c) => c.charCodeAt(0))
          next[slug] = URL.createObjectURL(new Blob([bytes], { type: shot.mime }))
          made.push(next[slug])
        }
      }
      if (alive) {
        setUrls(next)
      }
    })()
    return () => {
      alive = false
      made.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [runId, slugsKey, target])
  return urls
}

export function IssueGuideTab({
  target,
  detail,
  run,
  error,
  canWrite,
  onRun
}: {
  target: RuntimeClientTarget
  detail: BuildWebIssueDetail
  run: BuildWebRun | null | undefined
  error: string | null
  canWrite: boolean
  onRun: (run: BuildWebRun | null) => void
}): React.JSX.Element {
  const confirm = useConfirmationDialog()
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [draft, setDraft] = useState(run?.guide_markdown ?? '')
  const [busy, setBusy] = useState(false)
  useEffect(() => setDraft(run?.guide_markdown ?? ''), [run?.guide_markdown])
  const urls = useShotUrls(target, run?.id ?? '', run?.id ? draft : '')
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
  if (run === null || !run.guide_markdown) {
    return (
      <p className="text-sm text-muted-foreground">
        {translate(
          'buildWeb.guide.none',
          'No guide yet. It is written from the task’s build: make the build first.'
        )}
      </p>
    )
  }
  const act = async (action: () => Promise<void>) => {
    setBusy(true)
    try {
      await action()
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : String(failure))
    } finally {
      setBusy(false)
    }
  }
  const save = () =>
    act(async () => {
      const result = await callBuildWeb(target, 'saveGuide', { runId: run.id, guide: draft })
      if (result.ok) {
        onRun(result.value ?? run)
        toast.success(translate('buildWeb.guide.saved', 'Guide saved.'))
      } else {
        toast.error(result.error)
      }
    })
  const refreshImages = () =>
    act(async () => {
      const result = await callBuildWeb(target, 'refreshGuideImages', {
        runId: run.id,
        guide: draft
      })
      if (result.ok && result.value) {
        onRun(result.value)
      } else if (!result.ok) {
        toast.error(result.error)
      }
    })
  const publish = () =>
    act(async () => {
      const jiraKey = detail.jira_key
      if (!jiraKey) {
        return
      }
      const accepted = await confirm({
        title: translate('buildWeb.guide.publishTitle', 'Publish the guide to Jira {{key}}?', {
          key: jiraKey
        }),
        confirmLabel: translate('buildWeb.guide.publish', 'Publish to Jira')
      })
      if (!accepted) {
        return
      }
      const result = await callBuildWeb(target, 'publishGuide', {
        jiraKey,
        runId: run.id,
        guide: draft
      })
      if (result.ok) {
        toast.success(translate('buildWeb.guide.published', 'Published to Jira.'))
      } else {
        toast.error(result.error)
      }
    })

  return (
    <div className="flex flex-wrap gap-5">
      <section className="flex min-w-0 flex-[999_1_560px] flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={mode} onValueChange={(v) => setMode(v === 'edit' ? 'edit' : 'view')}>
            <TabsList>
              <TabsTrigger value="view">{translate('buildWeb.guide.view', 'Preview')}</TabsTrigger>
              <TabsTrigger value="edit">
                {translate('buildWeb.guide.markdown', 'Markdown')}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex-1" />
          {canWrite ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => void refreshImages()}
              >
                {translate('buildWeb.guide.refreshImages', 'Refresh images')}
              </Button>
              <Button
                size="sm"
                disabled={busy || draft === run.guide_markdown}
                onClick={() => void save()}
              >
                {translate('buildWeb.guide.save', 'Save')}
              </Button>
            </>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          {translate(
            'buildWeb.guide.note',
            'From the task’s build. A saved guide is written to the {{key}} card as a comment.',
            { key: detail.key }
          )}
        </p>
        {mode === 'edit' && canWrite ? (
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={20}
            variant="code"
            aria-label={translate('buildWeb.guide.markdown', 'Markdown')}
          />
        ) : (
          <div className="rounded-lg border border-border bg-card p-4">
            <CommentMarkdown
              content={withShotUrls(draft, urls)}
              variant="compact"
              className="text-sm"
            />
          </div>
        )}
      </section>
      <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-3 rounded-lg border border-border bg-card p-4 text-sm xl:max-w-[380px]">
        <h3 className="text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
          {translate('buildWeb.card.jira', 'Jira')}
        </h3>
        {detail.jira_key ? (
          <>
            <JiraStatusLine jiraKey={detail.jira_key} status={detail.jira_status} />
            <Button variant="outline" size="sm" disabled={busy} onClick={() => void publish()}>
              {translate('buildWeb.guide.publish', 'Publish to Jira')}
            </Button>
          </>
        ) : (
          <p className="text-muted-foreground">
            {translate('buildWeb.guide.noJira', 'The task has no Jira issue.')}
          </p>
        )}
      </aside>
    </div>
  )
}
