import { Bot, Star } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import type { BuildWebIssueRow } from '../../../../shared/build-web-types'
import { useBuildWebStore } from './build-web-store'
import { statusLabel, statusTone } from './build-web-labels'

function IssueRow({
  issue,
  selected,
  open,
  onToggle,
  onOpen,
  onFavorite
}: {
  issue: BuildWebIssueRow
  selected: boolean
  open: boolean
  onToggle: () => void
  onOpen: () => void
  onFavorite: () => void
}): React.JSX.Element {
  return (
    <tr
      data-current={open ? 'true' : undefined}
      className={cn('border-b border-border hover:bg-accent', (open || selected) && 'bg-accent')}
    >
      <td className="w-10 py-2 pl-3 md:pl-5">
        <Checkbox
          checked={selected}
          onCheckedChange={onToggle}
          aria-label={translate('buildWeb.list.select', 'Select {{key}}', { key: issue.key })}
        />
      </td>
      <td className="w-28 py-2 font-mono text-xs text-muted-foreground">{issue.key}</td>
      <td className="max-w-0 py-2">
        <button
          type="button"
          onClick={onOpen}
          className="block w-full truncate text-left text-sm hover:underline focus-visible:underline focus-visible:outline-none"
        >
          {issue.title}
        </button>
      </td>
      <td className="w-36 py-2">
        <Badge variant={statusTone(issue.status)}>{statusLabel(issue.status)}</Badge>
      </td>
      <td className="w-12 py-2 text-xs text-muted-foreground">P{issue.priority}</td>
      <td className="w-28 py-2 text-xs text-muted-foreground">{issue.version_name ?? '—'}</td>
      <td className="w-16 py-2 pr-3 md:pr-5">
        <div className="flex items-center justify-end gap-1">
          {issue.agent_session ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-muted-foreground">
                  <Bot
                    className="size-3.5"
                    aria-label={translate('buildWeb.list.session', 'Agent session')}
                  />
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {issue.agent_session.agent} · {issue.agent_session.worktree_name}
              </TooltipContent>
            </Tooltip>
          ) : null}
          <button
            type="button"
            onClick={onFavorite}
            aria-pressed={issue.favorite}
            aria-label={translate('buildWeb.list.favorite', 'Favorite {{key}}', { key: issue.key })}
            className="rounded p-1 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Star className={cn('size-3.5', issue.favorite && 'fill-current text-foreground')} />
          </button>
        </div>
      </td>
    </tr>
  )
}

export function BuildWebIssueList({
  onFavorite,
  onLoadMore
}: {
  onFavorite: (issue: BuildWebIssueRow) => void
  onLoadMore: () => void
}): React.JSX.Element {
  const issues = useBuildWebStore((s) => s.issues)
  const total = useBuildWebStore((s) => s.total)
  const loadingMore = useBuildWebStore((s) => s.loadingMore || s.loading)
  const selected = useBuildWebStore((s) => s.selected)
  const openIssueId = useBuildWebStore((s) => s.openIssueId)
  const toggleSelected = useBuildWebStore((s) => s.toggleSelected)
  const openIssue = useBuildWebStore((s) => s.openIssue)

  return (
    <div className="scrollbar-sleek min-h-0 flex-1 overflow-auto">
      <table className="w-full min-w-[640px] table-fixed border-collapse">
        <thead className="sticky top-0 z-10 bg-background">
          <tr className="border-b border-border text-left text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
            <th className="w-10 py-2 pl-3 md:pl-5">
              <span className="sr-only">{translate('buildWeb.list.selection', 'Selection')}</span>
            </th>
            <th className="w-28 py-2">{translate('buildWeb.list.key', 'Key')}</th>
            <th className="py-2">{translate('buildWeb.list.title', 'Title')}</th>
            <th className="w-36 py-2">{translate('buildWeb.list.status', 'Status')}</th>
            <th className="w-12 py-2">{translate('buildWeb.list.priority', 'Prio')}</th>
            <th className="w-28 py-2">{translate('buildWeb.list.release', 'Release')}</th>
            <th className="w-16 py-2 pr-3 md:pr-5">
              <span className="sr-only">{translate('buildWeb.list.marks', 'Marks')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {issues.map((issue) => (
            <IssueRow
              key={issue.id}
              issue={issue}
              selected={selected.has(issue.id)}
              open={openIssueId === issue.id}
              onToggle={() => toggleSelected(issue.id)}
              onOpen={() => openIssue(issue.id)}
              onFavorite={() => onFavorite(issue)}
            />
          ))}
        </tbody>
      </table>
      {total > issues.length ? (
        <div className="flex items-center justify-center gap-3 py-3 text-xs text-muted-foreground">
          {translate('buildWeb.list.shownOf', '{{shown}} of {{total}}', {
            shown: issues.length,
            total
          })}
          <Button variant="outline" size="sm" disabled={loadingMore} onClick={onLoadMore}>
            {translate('buildWeb.list.loadMore', 'Load more')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
