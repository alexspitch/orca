import { Archive, ChevronLeft, ExternalLink, Minimize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import type { BuildWebIssueDetail, BuildWebIssuePatch } from '../../../../../shared/build-web-types'
import { loginOf, productLabel, statusLabel } from '../build-web-labels'
import { BuildWebToneChip, PriorityChip, ProductChip, TypeChip } from '../BuildWebToneChip'
import { StatusPicker } from '../BuildWebRowPickers'
import { EditableTitle } from '../BuildWebIssueEditors'
import { nextStatus } from './issue-card-facts'
import { blockedBySubtasks } from '../BuildWebIssueSubtasks'
import type { IssueArchiveState } from './use-issue-archive'

/** An archived or deleted task still opens, from a link or a tab, and says where it is. */
function ArchivedNote({
  detail,
  archive
}: {
  detail: BuildWebIssueDetail
  archive: IssueArchiveState
}): React.JSX.Element | null {
  if (detail.deleted_at) {
    return (
      <p role="status" className="rounded-md border border-border bg-muted px-3 py-2 text-sm">
        {translate(
          'buildWeb.archive.deletedNote',
          'The task is in the trash. It is taken back in build-web’s Archive section.'
        )}
      </p>
    )
  }
  if (!detail.archived_at) {
    return null
  }
  return (
    <div
      role="status"
      className="flex items-center gap-3 rounded-md border border-border bg-muted px-3 py-2 text-sm"
    >
      <span className="flex-1">
        {translate(
          'buildWeb.archive.note',
          'In the archive: put away by {{who}} on {{when}}. It is not in the task list, the AI queue or trains.',
          {
            who: loginOf(detail.archived_by ?? ''),
            when: new Date(detail.archived_at).toLocaleString()
          }
        )}
      </span>
      <Button size="sm" variant="outline" disabled={archive.busy} onClick={archive.restore}>
        {translate('buildWeb.archive.restore', 'Restore')}
      </Button>
    </div>
  )
}

/** The full-screen card's head: where it is, what it is, and the moves out of it. */
export function IssueHeader({
  detail,
  saving,
  onSave,
  onTakeToWork,
  onCollapse,
  onBackToList,
  onOpenIssue,
  archive
}: {
  detail: BuildWebIssueDetail
  /** «Archive» on a live task, «Restore» on the note of an archived one. */
  archive: IssueArchiveState
  saving: boolean
  onSave: (patch: BuildWebIssuePatch) => void
  onTakeToWork: () => void
  /** Absent where there is no page to collapse back to (a workspace's tab). */
  onCollapse?: () => void
  /** The «Issues» crumb: the list, with no card open. */
  onBackToList: () => void
  /** The parent crumb of a subtask. */
  onOpenIssue: (id: string) => void
}): React.JSX.Element {
  const next = nextStatus(detail.status, Boolean(detail.parent_id))
  // The move the open subtasks forbid: build-web answers 409, so the button says so first.
  const blocked = next && next !== 'inprogress' ? blockedBySubtasks(detail) : ''
  return (
    <header className="flex flex-col gap-3 border-b border-border px-3 pb-3 md:px-5">
      <nav
        className="flex items-center gap-1 text-xs text-muted-foreground"
        aria-label={translate('buildWeb.card.path', 'Path')}
      >
        <button
          type="button"
          onClick={onBackToList}
          className="flex items-center gap-1 hover:text-foreground"
        >
          <ChevronLeft className="size-3.5" />
          {translate('buildWeb.page.title', 'Issues')}
        </button>
        <span>/</span>
        <span>{productLabel(detail.product)}</span>
        <span>/</span>
        {detail.parent_id && detail.parent_key ? (
          <>
            <button
              type="button"
              onClick={() => detail.parent_id && onOpenIssue(detail.parent_id)}
              className="font-mono hover:text-foreground hover:underline"
            >
              {detail.parent_key}
            </button>
            <span>/</span>
          </>
        ) : null}
        <span className="font-mono">{detail.key}</span>
      </nav>
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex min-w-0 flex-1 basis-[28rem] flex-col gap-2">
          <EditableTitle
            detail={detail}
            saving={saving}
            onSave={onSave}
            className="text-lg leading-snug font-semibold"
          />
          <div className="flex flex-wrap items-center gap-2">
            <StatusPicker issue={detail} busy={saving} onPatch={onSave} />
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
          {next && blocked ? (
            <Tooltip>
              <TooltipTrigger asChild>
                {/* Why the span: a disabled button gets no pointer events, so no tooltip. */}
                <span tabIndex={0}>
                  <Button size="sm" disabled>
                    {translate('buildWeb.card.moveTo', 'Move to “{{status}}”', {
                      status: statusLabel(next)
                    })}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>{blocked}</TooltipContent>
            </Tooltip>
          ) : next ? (
            <Button size="sm" disabled={saving} onClick={() => onSave({ status: next })}>
              {translate('buildWeb.card.moveTo', 'Move to “{{status}}”', {
                status: statusLabel(next)
              })}
            </Button>
          ) : null}
          {detail.archived_at ? null : (
            // Why no question: «Restore» on the card undoes it, as on the console.
            <Button variant="outline" size="sm" disabled={archive.busy} onClick={archive.archive}>
              <Archive />
              {translate('buildWeb.archive.archive', 'Archive')}
            </Button>
          )}
          {onCollapse ? (
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
          ) : null}
        </div>
      </div>
      <ArchivedNote detail={detail} archive={archive} />
    </header>
  )
}
