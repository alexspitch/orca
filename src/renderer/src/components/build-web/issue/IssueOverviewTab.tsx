import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { useConfirmationDialog } from '@/components/confirmation-dialog-context'
import { translate } from '@/i18n/i18n'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import type { IssueDetailState } from '../use-build-web-issue-detail'
import { callBuildWeb } from '../build-web-client'
import { BuildWebIssueFields } from '../BuildWebIssueFields'
import {
  BuildWebIssueComments,
  BuildWebIssueDescription,
  BuildWebIssueSteps,
  SectionTitle
} from '../BuildWebIssueBody'

function Panel({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground">
      <SectionTitle>{title}</SectionTitle>
      {children}
    </section>
  )
}

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
            <Checkbox checked={jira} onCheckedChange={(v) => setJira(v === true)} />
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
  state
}: {
  target: RuntimeClientTarget
  state: IssueDetailState
}) {
  const detail = state.detail
  if (!detail) {
    return null
  }
  return (
    <div className="flex flex-wrap gap-5">
      <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
        <Panel title={translate('buildWeb.detail.description', 'Description')}>
          <BuildWebIssueDescription detail={detail} />
        </Panel>
        <Panel title={translate('buildWeb.detail.steps', 'Steps')}>
          <BuildWebIssueSteps detail={detail} />
        </Panel>
        <Panel title={translate('buildWeb.detail.comments', 'Comments')}>
          <BuildWebIssueComments detail={detail} />
          <CommentComposer target={target} state={state} />
        </Panel>
      </div>
      <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-4 xl:max-w-[400px]">
        <Panel title={translate('buildWeb.card.properties', 'Properties')}>
          <BuildWebIssueFields
            detail={detail}
            assignees={state.assignees}
            versions={state.versions}
            disabled={state.saving}
            onSave={(patch) => void state.save(patch)}
          />
        </Panel>
        <Panel title={translate('buildWeb.card.work', 'Work')}>
          <div className="flex flex-col gap-1 font-mono text-xs">
            {detail.branches.map((branch, n) => (
              <span key={branch}>
                {branch}
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
        </Panel>
        {detail.jira_key ? (
          <Panel title={translate('buildWeb.card.jira', 'Jira')}>
            <p className="text-sm">
              <span className="font-mono">{detail.jira_key}</span>
              {detail.jira_status ? (
                <span className="text-muted-foreground"> · {detail.jira_status}</span>
              ) : null}
            </p>
          </Panel>
        ) : null}
      </aside>
    </div>
  )
}
