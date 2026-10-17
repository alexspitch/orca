import { ExternalLink, Maximize2, X } from 'lucide-react'
import * as VisuallyHidden from 'radix-ui/visually-hidden'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { useBuildWebStore } from './build-web-store'
import { useBuildWebIssueDetail } from './use-build-web-issue-detail'
import { BuildWebIssueFields } from './BuildWebIssueFields'
import {
  BuildWebIssueComments,
  BuildWebIssueDescription,
  BuildWebIssueSteps,
  SectionTitle
} from './BuildWebIssueBody'
import { productLabel } from './build-web-labels'
import { BuildWebSessionBadge } from './BuildWebSessionBadge'

/** The side card of a task: fields to edit, its text to read, and the ways out of it. */
export function BuildWebIssueDrawer({
  onTakeToWork
}: {
  onTakeToWork: (ids: string[]) => void
}): React.JSX.Element {
  const openIssueId = useBuildWebStore((s) => s.openIssueId)
  const fullScreen = useBuildWebStore((s) => s.fullScreen)
  const openIssue = useBuildWebStore((s) => s.openIssue)
  const { detail, error, assignees, versions, saving, save } = useBuildWebIssueDetail(
    fullScreen ? null : openIssueId
  )
  const open = openIssueId !== null && !fullScreen

  return (
    <Sheet open={open} onOpenChange={(next) => !next && openIssue(null)}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-[min(92vw,560px)] sm:max-w-[560px]"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <VisuallyHidden.Root asChild>
          <SheetTitle>{detail?.title ?? translate('buildWeb.detail.task', 'Task')}</SheetTitle>
        </VisuallyHidden.Root>
        <VisuallyHidden.Root asChild>
          <SheetDescription>
            {translate(
              'buildWeb.detail.sheetDescription',
              'Edit the task and hand it to an agent.'
            )}
          </SheetDescription>
        </VisuallyHidden.Root>
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <span className="font-mono text-sm text-muted-foreground">{detail?.key}</span>
          {detail ? (
            <span className="text-xs text-muted-foreground">
              {productLabel(detail.product)} · {detail.type}
            </span>
          ) : null}
          <div className="flex-1" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={!openIssueId}
                onClick={() => openIssueId && openIssue(openIssueId, true)}
                aria-label={translate('buildWeb.detail.fullScreen', 'Open full screen')}
              >
                <Maximize2 />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {translate('buildWeb.detail.fullScreen', 'Open full screen')}
            </TooltipContent>
          </Tooltip>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => openIssue(null)}
            aria-label={translate('buildWeb.detail.close', 'Close')}
          >
            <X />
          </Button>
        </div>
        <div className="scrollbar-sleek flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-4">
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : !detail ? null : (
            <>
              {detail.agent_session ? (
                <BuildWebSessionBadge session={detail.agent_session} />
              ) : null}
              <BuildWebIssueFields
                detail={detail}
                assignees={assignees}
                versions={versions}
                disabled={saving}
                onSave={(patch) => void save(patch)}
              />
              <section className="flex flex-col gap-2">
                <SectionTitle>
                  {translate('buildWeb.detail.description', 'Description')}
                </SectionTitle>
                <BuildWebIssueDescription detail={detail} />
              </section>
              <section className="flex flex-col gap-2">
                <SectionTitle>{translate('buildWeb.detail.steps', 'Steps')}</SectionTitle>
                <BuildWebIssueSteps detail={detail} />
              </section>
              <section className="flex flex-col gap-2">
                <SectionTitle>{translate('buildWeb.detail.comments', 'Comments')}</SectionTitle>
                <BuildWebIssueComments detail={detail} />
              </section>
            </>
          )}
        </div>
        {detail ? (
          <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void window.api.shell.openUrl(detail.url)}
            >
              {translate('buildWeb.detail.openInBuildWeb', 'Open in build-web')}
              <ExternalLink />
            </Button>
            <Button size="sm" onClick={() => onTakeToWork([detail.id])}>
              {translate('buildWeb.detail.takeToWork', 'Take to work')}
            </Button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
