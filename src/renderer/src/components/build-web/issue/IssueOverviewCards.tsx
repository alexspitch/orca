import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type { BuildWebIssueDetail } from '../../../../../shared/build-web-types'
import type { BuildWebRun } from '../../../../../shared/build-web-run-types'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import { SectionTitle } from '../BuildWebIssueBody'
import { BuildWebToneChip, JiraStatusLine } from '../BuildWebToneChip'
import { runStatusTone } from '../build-web-tones'
import { imageTally } from './issue-card-facts'
import { JiraDraftDialog } from './JiraDraftDialog'

// The overview's side cards that build-web shows beside «Свойства»: the build at a glance, and
// the task's Jira issue — or the way to file one.

export function OverviewPanel({
  title,
  action,
  children
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground">
      <div className="flex items-center gap-2">
        <SectionTitle>{title}</SectionTitle>
        <div className="flex-1" />
        {action}
      </div>
      {children}
    </section>
  )
}

function tallyLine(t: { ok: number; failed: number; total: number }): string {
  if (!t.total) {
    return translate('buildWeb.overview.noImages', 'no images')
  }
  const head = translate('buildWeb.overview.built', '{{ok}} of {{total}} images built', {
    ok: String(t.ok),
    total: String(t.total)
  })
  return t.failed
    ? `${head} · ${translate('buildWeb.overview.failed', '{{n}} failed', { n: String(t.failed) })}`
    : head
}

export function BuildSummaryCard({
  run,
  onOpenBuild
}: {
  run: BuildWebRun | null | undefined
  onOpenBuild: () => void
}): React.JSX.Element {
  const tally = run ? imageTally(run) : null
  const rest = tally ? tally.total - tally.ok - tally.failed : 0
  return (
    <OverviewPanel
      title={translate('buildWeb.card.build', 'Build')}
      action={run ? <BuildWebToneChip label={run.status} tone={runStatusTone(run.status)} /> : null}
    >
      {run && tally ? (
        <>
          <div className="flex gap-1" aria-hidden>
            {tally.ok > 0 ? (
              <span
                className="h-1.5 rounded-full bg-chip-tone-green"
                style={{ flexGrow: tally.ok }}
              />
            ) : null}
            {tally.failed > 0 ? (
              <span
                className="h-1.5 rounded-full bg-chip-tone-red"
                style={{ flexGrow: tally.failed }}
              />
            ) : null}
            {rest > 0 ? (
              <span className="h-1.5 rounded-full bg-border" style={{ flexGrow: rest }} />
            ) : null}
          </div>
          <span className="text-xs text-muted-foreground">{tallyLine(tally)}</span>
        </>
      ) : (
        <span className="text-sm text-muted-foreground">
          {run === undefined
            ? translate('buildWeb.state.loadingCard', 'Loading…')
            : translate('buildWeb.overview.noBuilds', 'No builds yet.')}
        </span>
      )}
      <button
        type="button"
        className="self-start text-sm font-semibold text-primary hover:underline"
        onClick={onOpenBuild}
      >
        {run
          ? translate('buildWeb.overview.openBuild', 'Open the «Build» tab →')
          : translate('buildWeb.overview.build', 'Build →')}
      </button>
    </OverviewPanel>
  )
}

export function JiraCard({
  target,
  detail,
  canCreate,
  onCreated
}: {
  target: RuntimeClientTarget
  detail: BuildWebIssueDetail
  canCreate: boolean
  onCreated: () => void
}): React.JSX.Element {
  const [drafting, setDrafting] = useState(false)
  return (
    <OverviewPanel
      title={translate('buildWeb.card.jira', 'Jira')}
      action={
        detail.jira_key || !canCreate ? null : (
          <Button variant="outline" size="xs" onClick={() => setDrafting(true)}>
            {translate('buildWeb.jiraDraft.createShort', 'Create')}
          </Button>
        )
      }
    >
      {detail.jira_key ? (
        <div className="flex flex-col gap-1">
          <JiraStatusLine jiraKey={detail.jira_key} status={detail.jira_status} />
          <span className="text-2xs text-muted-foreground">
            {translate('buildWeb.overview.fixVersions', 'Fix versions {{versions}}', {
              versions: detail.jira_fix_version || '—'
            })}
          </span>
        </div>
      ) : (
        <span
          className="text-sm text-muted-foreground"
          title={translate('buildWeb.jiraDraft.hint', 'the draft can be edited before it is sent')}
        >
          {translate('buildWeb.overview.notLinked', 'not linked')}
        </span>
      )}
      {drafting ? (
        <JiraDraftDialog
          target={target}
          issueId={detail.id}
          onClose={() => setDrafting(false)}
          onCreated={() => {
            setDrafting(false)
            onCreated()
          }}
        />
      ) : null}
    </OverviewPanel>
  )
}
