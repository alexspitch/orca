import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type { BuildWebRun } from '../../../../../../shared/build-web-run-types'

/** One place the guide goes, and whether it goes there. */
function Target({ checked, title, note }: { checked: boolean; title: string; note: string }) {
  return (
    <div
      className={cn(
        'flex items-start gap-2.5 rounded-md border border-border px-3 py-2.5',
        !checked && 'bg-muted/50'
      )}
    >
      <Checkbox checked={checked} disabled className="mt-0.5" aria-label={title} />
      <div className="flex flex-col gap-0.5">
        <span className={cn('text-sm font-medium', !checked && 'text-muted-foreground')}>
          {title}
        </span>
        <span className="text-xs text-muted-foreground">{note}</span>
      </div>
    </div>
  )
}

/** «Куда публиковать»: the task's card always, its Jira issue on a confirmed press. */
export function GuidePublishCard({
  run,
  jiraKey,
  hasGuide,
  posting,
  result,
  onPublish
}: {
  run: BuildWebRun
  jiraKey: string | null
  hasGuide: boolean
  posting: boolean
  result: { action: string; url: string } | null
  onPublish: () => void
}): React.JSX.Element {
  const [confirming, setConfirming] = useState(false)
  const openUrl = (url: string) => void window.api.shell.openUrl(url)
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 text-sm">
      <h3 className="text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
        {translate('buildWeb.guide.where', 'Where to publish')}
      </h3>
      {run.issue_id ? (
        <Target
          checked
          title={translate('buildWeb.guide.toCard', 'Comment on the task’s card')}
          note={translate(
            'buildWeb.guide.toCardNote',
            'written by itself when the guide is saved, and updated rather than repeated'
          )}
        />
      ) : null}
      <Target
        checked={Boolean(jiraKey)}
        title={
          jiraKey
            ? translate('buildWeb.guide.toJiraKey', 'Comment in Jira · {{key}}', { key: jiraKey })
            : translate('buildWeb.guide.toJira', 'Comment in Jira')
        }
        note={
          jiraKey
            ? run.jira_action
              ? translate('buildWeb.guide.lastPublished', 'last published: {{action}}', {
                  action: run.jira_action
                })
              : translate('buildWeb.guide.notPublished', 'not published yet')
            : translate(
                'buildWeb.guide.noJiraTarget',
                'the task has no Jira issue — nowhere to publish'
              )
        }
      />
      <p className="text-xs text-muted-foreground">
        {translate(
          'buildWeb.guide.codeCut',
          'The «Where it lives in the code» section is cut before publishing.'
        )}
      </p>
      {confirming && jiraKey ? (
        <div className="flex flex-col gap-2 rounded-md bg-accent p-3">
          <p className="text-sm">
            {translate(
              'buildWeb.guide.confirmPublish',
              'Everyone who opens {{key}} in Jira will see the guide. Publish?',
              { key: jiraKey }
            )}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
              {translate('buildWeb.guide.cancel', 'Cancel')}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setConfirming(false)
                onPublish()
              }}
            >
              {translate('buildWeb.guide.publishNow', 'Publish')}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          size="sm"
          disabled={posting || !hasGuide || !jiraKey}
          onClick={() => setConfirming(true)}
        >
          {posting
            ? translate('buildWeb.guide.publishing', 'Publishing…')
            : run.jira_action
              ? translate('buildWeb.guide.updateComment', 'Update the comment')
              : translate('buildWeb.guide.publishNow', 'Publish')}
        </Button>
      )}
      {result && jiraKey ? (
        <p className="text-xs text-chip-tone-green">
          {result.action === 'created'
            ? translate('buildWeb.guide.created', 'Comment created —')
            : translate('buildWeb.guide.updated', 'Comment updated —')}{' '}
          <button type="button" className="underline" onClick={() => openUrl(result.url)}>
            {translate('buildWeb.guide.openKey', 'open {{key}}', { key: jiraKey })}
          </button>
        </p>
      ) : null}
      {run.jira_url && !result && jiraKey ? (
        <button
          type="button"
          className="self-start text-xs text-primary hover:underline"
          onClick={() => run.jira_url && openUrl(run.jira_url)}
        >
          {translate('buildWeb.guide.openComment', 'open the comment in {{key}}', { key: jiraKey })}
        </button>
      ) : null}
    </section>
  )
}
