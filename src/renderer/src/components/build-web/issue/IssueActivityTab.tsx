import { useMemo, useState } from 'react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { translate } from '@/i18n/i18n'
import { formatUiRelativeTimeFromDate } from '@/i18n/relative-time-format'
import type { BuildWebIssueEvent } from '../../../../../shared/build-web-types'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import { personLabel } from '../build-web-labels'
import { useBuildWebTesters } from '../BuildWebIssueTester'
import { BuildWebToneChip } from '../BuildWebToneChip'
import {
  ISSUE_ACTIVITY_GROUPS,
  activityActorOf,
  activityResultOf,
  activityRowsOf,
  type IssueActivityGroup
} from './issue-activity'
import { isJiraLogin } from './issue-tester'
import { OverviewPanel } from './IssueOverviewCards'

function groupText(group: IssueActivityGroup): { chip: string; hint: string } {
  switch (group) {
    case 'all':
      return {
        chip: translate('buildWeb.issueActivity.all', 'All'),
        hint: translate('buildWeb.issueActivity.allHint', 'Everything that happened to the task')
      }
    case 'changes':
      return {
        chip: translate('buildWeb.issueActivity.changes', 'Changes'),
        hint: translate(
          'buildWeb.issueActivity.changesHint',
          'Fields, statuses, test cases, the verdict, the agent'
        )
      }
    case 'talk':
      return {
        chip: translate('buildWeb.issueActivity.talk', 'Comments & files'),
        hint: translate('buildWeb.issueActivity.talkHint', 'Comments, attachments, subtasks')
      }
    case 'notify':
      return {
        chip: translate('buildWeb.issueActivity.notify', 'Notifications'),
        hint: translate(
          'buildWeb.issueActivity.notifyHint',
          'Who was told, and through which channel'
        )
      }
    case 'build':
      return {
        chip: translate('buildWeb.issueActivity.build', 'Builds'),
        hint: translate('buildWeb.issueActivity.buildHint', 'Builds started, and how they ended')
      }
    case 'guide':
      return {
        chip: translate('buildWeb.issueActivity.guide', 'Guide & Jira'),
        hint: translate(
          'buildWeb.issueActivity.guideHint',
          'The guide, comments and attachments in Jira, the Jira status'
        )
      }
  }
}

function ActivityRow({
  event: e,
  author
}: {
  event: BuildWebIssueEvent
  author: string
}): React.JSX.Element {
  const result = activityResultOf(e, {
    delivered: translate('buildWeb.issueActivity.delivered', 'delivered'),
    success: translate('buildWeb.issueActivity.success', 'success'),
    notDelivered: translate('buildWeb.issueActivity.notDelivered', 'not delivered'),
    failed: translate('buildWeb.issueActivity.failed', 'failed'),
    cancelled: translate('buildWeb.issueActivity.cancelled', 'cancelled')
  })
  const at = new Date(e.created_at)
  return (
    <tr className="border-b border-border/60 last:border-b-0 hover:bg-accent">
      <td className="max-w-0 py-1.5 pr-3 pl-4">
        <span
          className="block truncate text-xs text-muted-foreground"
          title={Number.isNaN(at.getTime()) ? undefined : at.toLocaleString()}
        >
          {formatUiRelativeTimeFromDate(e.created_at, '—')}
        </span>
      </td>
      <td className="max-w-0 py-1.5 pr-3">
        <span className="block truncate" title={author}>
          {author}
        </span>
      </td>
      <td className="max-w-0 py-1.5 pr-3">
        <span className="block truncate" title={e.text}>
          {e.text}
        </span>
      </td>
      <td className="max-w-0 py-1.5 pr-4">
        {result ? (
          <BuildWebToneChip label={result.label} tone={result.tone} title={result.hint || null} />
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  )
}

/**
 * IS-354: everything that happened to the task in one table, as build-web's «Активность» — the
 * changes of its fields and statuses, and the operations with it with their result. The rows come
 * with the card.
 */
export function IssueActivityTab({
  target,
  events
}: {
  target: RuntimeClientTarget
  events: readonly BuildWebIssueEvent[]
}): React.JSX.Element {
  const [group, setGroup] = useState<IssueActivityGroup>('all')
  const rows = useMemo(() => activityRowsOf(events, group), [events, group])
  // Why only then: the console's people are needed only to name somebody known from Jira.
  const { people } = useBuildWebTesters(
    target,
    events.some((e) => isJiraLogin(e.author))
  )
  const actorWords = {
    train: (name: string) => translate('buildWeb.issueActivity.train', 'train {{name}}', { name }),
    watch: translate('buildWeb.issueActivity.watch', 'watcher'),
    ai: translate('buildWeb.issueActivity.ai', 'AI')
  }
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-3">
      <OverviewPanel
        title={translate('buildWeb.issueActivity.title', 'Activity')}
        action={
          <span className="text-xs text-muted-foreground tabular-nums">
            {translate('buildWeb.issueActivity.count', '{{count}} row(s)', { count: rows.length })}
          </span>
        }
      >
        <div className="scrollbar-sleek overflow-x-auto">
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={group}
            // Why the guard: a single toggle group lets the pressed item be clicked off.
            onValueChange={(next) => {
              const picked = ISSUE_ACTIVITY_GROUPS.find((g) => g === next)
              if (picked) {
                setGroup(picked)
              }
            }}
            aria-label={translate('buildWeb.issueActivity.filter', 'What to show')}
          >
            {ISSUE_ACTIVITY_GROUPS.map((g) => {
              const text = groupText(g)
              return (
                <ToggleGroupItem key={g} value={g} title={text.hint}>
                  {text.chip}
                </ToggleGroupItem>
              )
            })}
          </ToggleGroup>
        </div>
        {rows.length ? (
          <div className="scrollbar-sleek -mx-4 overflow-x-auto">
            <table className="w-full min-w-[640px] table-fixed border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
                  <th className="w-36 py-2 pl-4">
                    {translate('buildWeb.issueActivity.date', 'Date')}
                  </th>
                  <th className="w-36 py-2">
                    {translate('buildWeb.issueActivity.author', 'Author')}
                  </th>
                  <th className="py-2">
                    {translate('buildWeb.issueActivity.description', 'Description')}
                  </th>
                  <th className="w-32 py-2 pr-4">
                    {translate('buildWeb.issueActivity.result', 'Result')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <ActivityRow
                    key={e.id}
                    event={e}
                    author={activityActorOf(e.author, actorWords, (who) =>
                      personLabel(who, people)
                    )}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {translate('buildWeb.issueActivity.empty', 'Nothing here yet.')}
          </p>
        )}
      </OverviewPanel>
    </div>
  )
}
