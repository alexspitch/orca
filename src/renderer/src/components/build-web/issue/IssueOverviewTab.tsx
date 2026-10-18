import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { useConfirmationDialog } from '@/components/confirmation-dialog-context'
import { translate } from '@/i18n/i18n'
import { ResizableSplit } from './ResizableSplit'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import type { IssueDetailState } from '../use-build-web-issue-detail'
import type { BuildWebIssuePatch } from '../../../../../shared/build-web-types'
import type { BuildWebRun, BuildWebTestingStatus } from '../../../../../shared/build-web-run-types'
import { callBuildWeb } from '../build-web-client'
import { BuildWebIssueProperties } from '../BuildWebIssueProperties'
import { BuildWebIssueComments } from '../BuildWebIssueComments'
import { EditableDescription, EditableSteps } from '../BuildWebIssueEditors'
import { BuildWebToneChip } from '../BuildWebToneChip'
import { BuildSummaryCard, JiraCard, OverviewPanel } from './IssueOverviewCards'

function CommentComposer({
  target,
  state
}: {
  target: RuntimeClientTarget
  state: IssueDetailState
}) {
  const confirm = useConfirmationDialog()
  const [body, setBody] = useState('')
  const [jira, setJira] = useState(false)
  const [sending, setSending] = useState(false)
  const detail = state.detail
  if (!detail) {
    return null
  }
  const send = async (): Promise<void> => {
    if (jira && detail.jira_key) {
      const accepted = await confirm({
        title: translate(
          'buildWeb.card.commentJiraTitle',
          'Post this comment to Jira {{key}} too?',
          { key: detail.jira_key }
        ),
        confirmLabel: translate('buildWeb.card.send', 'Send')
      })
      if (!accepted) {
        return
      }
    }
    setSending(true)
    try {
      const result = await callBuildWeb(target, 'addComment', {
        id: detail.id,
        body: body.trim(),
        jira: jira && Boolean(detail.jira_key)
      })
      if (result.ok) {
        setBody('')
        state.reload()
        if (result.value.jira && !result.value.jira.ok) {
          toast.error(
            translate(
              'buildWeb.card.commentNotInJira',
              'Saved, but not posted to Jira: {{error}}',
              {
                error: result.value.jira.error
              }
            )
          )
        }
      } else {
        toast.error(result.error)
      }
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : String(failure))
    } finally {
      setSending(false)
    }
  }
  return (
    <div className="flex flex-col gap-2">
      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder={translate('buildWeb.card.commentPlaceholder', 'Comment…')}
        aria-label={translate('buildWeb.card.comment', 'Comment')}
        rows={3}
        maxLength={4000}
      />
      <div className="flex items-center gap-3">
        {detail.jira_key ? (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              emphasis="strong"
              checked={jira}
              onCheckedChange={(v) => setJira(v === true)}
            />
            {translate('buildWeb.card.alsoJira', 'and in Jira')}
          </label>
        ) : null}
        <div className="flex-1" />
        <Button size="sm" disabled={sending || !body.trim()} onClick={() => void send()}>
          {translate('buildWeb.card.send', 'Send')}
        </Button>
      </div>
    </div>
  )
}

export function IssueOverviewTab({
  target,
  state,
  run,
  showRuns,
  testing,
  onOpenBuild,
  onOpenIssue
}: {
  target: RuntimeClientTarget
  state: IssueDetailState
  /** The task's run, for the «Build» card; shown only where runs are read and the task is not a subtask. */
  run: BuildWebRun | null | undefined
  showRuns: boolean
  testing: { value: BuildWebTestingStatus; onChange: (value: BuildWebTestingStatus) => void } | null
  onOpenBuild: () => void
  onOpenIssue: (id: string) => void
}) {
  const detail = state.detail
  if (!detail) {
    return null
  }
  const save = (patch: BuildWebIssuePatch) => void state.save(patch)
  return (
    <ResizableSplit
      panel="overview"
      side="right"
      defaultWidth={380}
      minWidth={300}
      aside={
        <aside className="flex min-w-0 flex-col gap-4">
          {showRuns ? <BuildSummaryCard run={run} onOpenBuild={onOpenBuild} /> : null}
          <OverviewPanel title={translate('buildWeb.card.properties', 'Properties')}>
            <BuildWebIssueProperties
              target={target}
              detail={detail}
              assignees={state.assignees}
              versions={state.versions}
              disabled={state.saving}
              onSave={state.save}
              onReload={state.reload}
              testing={showRuns ? testing : null}
              onOpenParent={onOpenIssue}
            />
          </OverviewPanel>
          <OverviewPanel title={translate('buildWeb.card.work', 'Work')}>
            <div className="flex flex-col items-start gap-1 text-xs">
              {detail.branches.map((branch, n) => (
                <span key={branch} className="flex items-center gap-1">
                  <BuildWebToneChip label={branch} tone={null} mono />
                  {n === 0 ? (
                    <span className="font-sans text-muted-foreground">
                      {' '}
                      — {translate('buildWeb.card.buildBranch', 'build')}
                    </span>
                  ) : null}
                </span>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {translate('buildWeb.card.commitPrefix', 'Commits prefixed {{key}}', {
                key: detail.key
              })}
            </p>
          </OverviewPanel>
          <JiraCard target={target} detail={detail} canCreate onCreated={state.reload} />
        </aside>
      }
    >
      <div className="flex min-w-0 flex-col gap-4">
        <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 text-card-foreground">
          <EditableDescription detail={detail} canEdit saving={state.saving} onSave={save} />
          <EditableSteps detail={detail} canEdit saving={state.saving} onSave={save} />
        </section>
        <OverviewPanel title={translate('buildWeb.detail.comments', 'Comments')}>
          <BuildWebIssueComments target={target} detail={detail} onChanged={state.reload} />
          <CommentComposer target={target} state={state} />
        </OverviewPanel>
      </div>
    </ResizableSplit>
  )
}
