import { ChevronLeft, ExternalLink, Minimize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import type { BuildWebIssueDetail, BuildWebIssuePatch } from '../../../../../shared/build-web-types'
import { productLabel, statusLabel } from '../build-web-labels'
import {
  BuildWebToneChip,
  PriorityChip,
  ProductChip,
  StatusChip,
  TypeChip
} from '../BuildWebToneChip'
import { BuildWebSessionBadge } from '../BuildWebSessionBadge'
import { nextStatus } from './issue-card-facts'

/** The full-screen card's head: where it is, what it is, and the moves out of it. */
export function IssueHeader({
  detail,
  saving,
  onSave,
  onTakeToWork,
  onCollapse
}: {
  detail: BuildWebIssueDetail
  saving: boolean
  onSave: (patch: BuildWebIssuePatch) => void
  onTakeToWork: () => void
  onCollapse: () => void
}): React.JSX.Element {
  const next = nextStatus(detail.status, Boolean(detail.parent_id))
  return (
    <header className="flex flex-col gap-3 border-b border-border px-3 pb-3 md:px-5">
      <nav
        className="flex items-center gap-1 text-xs text-muted-foreground"
        aria-label={translate('buildWeb.card.path', 'Path')}
      >
        <button
          type="button"
          onClick={onCollapse}
          className="flex items-center gap-1 hover:text-foreground"
        >
          <ChevronLeft className="size-3.5" />
          {translate('buildWeb.page.title', 'Issues')}
        </button>
        <span>/</span>
        <span>{productLabel(detail.product)}</span>
        <span>/</span>
        {detail.parent_key ? (
          <>
            <span className="font-mono">{detail.parent_key}</span>
            <span>/</span>
          </>
        ) : null}
        <span className="font-mono">{detail.key}</span>
      </nav>
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex min-w-0 flex-1 basis-[28rem] flex-col gap-2">
          <h1 className="text-lg leading-snug font-semibold">{detail.title}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip status={detail.status} />
            <ProductChip product={detail.product} />
            <TypeChip type={detail.type} />
            <PriorityChip priority={detail.priority} />
            {detail.version_name ? (
              <BuildWebToneChip label={detail.version_name} tone={null} mono />
            ) : null}
            {detail.for_ai ? (
              <BuildWebToneChip
                label={translate('buildWeb.detail.forAi', 'Handed to AI')}
                tone="purple"
              />
            ) : null}
            <span className="text-xs text-muted-foreground">
              {translate('buildWeb.card.byline', '{{author}} · created {{created}}', {
                author: detail.created_by,
                created: new Date(detail.created_at).toLocaleDateString()
              })}
            </span>
          </div>
          {detail.agent_session ? <BuildWebSessionBadge session={detail.agent_session} /> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void window.api.shell.openUrl(detail.url)}
          >
            {translate('buildWeb.detail.openInBuildWeb', 'Open in build-web')}
            <ExternalLink />
          </Button>
          <Button variant="outline" size="sm" onClick={onTakeToWork}>
            {translate('buildWeb.detail.takeToWork', 'Take to work')}
          </Button>
          {next ? (
            <Button size="sm" disabled={saving} onClick={() => onSave({ status: next })}>
              {translate('buildWeb.card.moveTo', 'Move to “{{status}}”', {
                status: statusLabel(next)
              })}
            </Button>
          ) : null}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onCollapse}
                aria-label={translate('buildWeb.card.collapse', 'Collapse')}
              >
                <Minimize2 />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{translate('buildWeb.card.collapse', 'Collapse')}</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </header>
  )
}
