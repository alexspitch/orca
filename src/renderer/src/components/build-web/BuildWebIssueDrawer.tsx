import { ExternalLink, Maximize2, X } from 'lucide-react'
import * as VisuallyHidden from 'radix-ui/visually-hidden'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import type { BuildWebIssueRow } from '../../../../shared/build-web-types'
import { useBuildWebStore } from './build-web-store'
import { useBuildWebIssueDetail } from './use-build-web-issue-detail'
import { BuildWebIssueProperties } from './BuildWebIssueProperties'
import { BuildWebIssueComments } from './BuildWebIssueComments'
import { EditableDescription, EditableSteps, EditableTitle } from './BuildWebIssueEditors'
import { SectionTitle } from './BuildWebIssueBody'
import { useBuildWebTarget } from './use-build-web-data'
import { BuildWebSessionBadge } from './BuildWebSessionBadge'
import { PriorityChip, ProductChip, StatusChip, TypeChip } from './BuildWebToneChip'
import { useBuildWebDrawerWidth } from './use-build-web-drawer-width'

/** The side card of a task: fields to edit, its text to read, and the ways out of it. */
export function BuildWebIssueDrawer({
  onTakeToWork
}: {
  onTakeToWork: (issues: BuildWebIssueRow[]) => void
}): React.JSX.Element {
  const openIssueId = useBuildWebStore((s) => s.openIssueId)
  const fullScreen = useBuildWebStore((s) => s.fullScreen)
  const openIssue = useBuildWebStore((s) => s.openIssue)
  const { target } = useBuildWebTarget()
  const { detail, error, assignees, versions, saving, save, reload } = useBuildWebIssueDetail(
    fullScreen ? null : openIssueId
  )
  const open = openIssueId !== null && !fullScreen
  const resize = useBuildWebDrawerWidth()

  return (
    <Sheet open={open} onOpenChange={(next) => !next && openIssue(null)}>
      <SheetContent
        ref={resize.containerRef}
        side="right"
        showCloseButton={false}
        className="max-w-none sm:max-w-none"
        style={{ width: resize.width }}
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={translate('buildWeb.detail.resize', 'Resize the card')}
          aria-valuenow={resize.width}
          aria-valuemin={resize.minWidth}
          aria-valuemax={resize.maxWidth}
          tabIndex={0}
          onMouseDown={resize.onResizeStart}
          onKeyDown={resize.onKeyDown}
          className="absolute top-0 left-0 z-10 h-full w-1 cursor-col-resize transition-colors hover:bg-ring/20 focus-visible:bg-ring/30 focus-visible:outline-none active:bg-ring/30"
        />
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
            <span className="flex min-w-0 flex-wrap items-center gap-1.5">
              <ProductChip product={detail.product} />
              <TypeChip type={detail.type} />
              <StatusChip status={detail.status} />
              <PriorityChip priority={detail.priority} />
            </span>
          ) : null}
          <div className="flex-1" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={!openIssueId}
                onClick={() => useBuildWebStore.getState().expandToFullScreen()}
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
              <EditableTitle
                detail={detail}
                saving={saving}
                onSave={(patch) => void save(patch)}
                className="text-base leading-snug font-semibold"
              />
              <section className="flex flex-col gap-2">
                <SectionTitle>{translate('buildWeb.card.properties', 'Properties')}</SectionTitle>
                <BuildWebIssueProperties
                  target={target}
                  detail={detail}
                  assignees={assignees}
                  versions={versions}
                  disabled={saving}
                  onSave={save}
                  onReload={reload}
                  onOpenParent={(id) => openIssue(id)}
                />
              </section>
              <EditableDescription
                detail={detail}
                canEdit
                saving={saving}
                onSave={(patch) => void save(patch)}
              />
              <EditableSteps
                detail={detail}
                canEdit
                saving={saving}
                onSave={(patch) => void save(patch)}
              />
              <section className="flex flex-col gap-2">
                <SectionTitle>{translate('buildWeb.detail.comments', 'Comments')}</SectionTitle>
                <BuildWebIssueComments target={target} detail={detail} onChanged={reload} />
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
            <Button size="sm" onClick={() => onTakeToWork([detail])}>
              {translate('buildWeb.detail.takeToWork', 'Take to work')}
            </Button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
