import React from 'react'
import { Laptop, Server, ServerOff } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { getLocalExecutionHostLabel } from '../../../../shared/execution-host'
import { getWorkspaceAttachments } from '../../../../shared/workspace-attachments'
import { WorktreeCardDetailsHover } from './WorktreeCardMeta'
import type { WorktreeCardDetailsHoverProps } from './worktree-card-meta-types'
import { WorktreeCardPortsDetails } from './WorktreeCardPorts'
import { WorktreeTaskKey } from './WorktreeCardTaskSession'
import type { WorktreeCardController } from './use-worktree-card-controller'
import type { WorktreeCardPresentation } from './worktree-card-presentation'

// IS-147: a row opens a card only from what names it, never from its body. The task number opens
// the details; the «Project on …» element opens the host with its live ports, and the details too
// on a task row. A row without a task shows no details card at all.

// Why 500 ms: the number sits where the pointer passes on its way to the title.
const TASK_KEY_DETAILS_OPEN_DELAY_MS = 500

type DetailsProps = Omit<WorktreeCardDetailsHoverProps, 'children'>

const NO_DETAILS: DetailsProps = {
  issue: null,
  linearIssue: null,
  review: null,
  comment: null
}

function workspaceDetailsProps(
  card: WorktreeCardController,
  presentation: WorktreeCardPresentation
): DetailsProps {
  const { worktree, repo, affiliateListMode, isDeleting, linearIssue } = card
  return {
    workspace: worktree,
    referenceDetails: card.referenceDetails,
    onManageLinks: affiliateListMode ? undefined : card.handleManageLinks,
    issue: card.hoverIssue,
    linearIssue: card.hoverLinearIssue,
    jiraIssue: card.hoverJiraIssue,
    review: card.hoverReview,
    comment: card.hoverComment,
    automationProvenance: card.metaAutomationProvenance,
    cliProvenance: card.metaCliProvenance,
    branchName: presentation.hoverBranchName,
    workspaceTitle: presentation.hoverWorkspaceTitle,
    workspaceTitleRenameDisabled: isDeleting || affiliateListMode,
    onRenameWorkspaceTitle: affiliateListMode ? undefined : card.handleRenameTitle,
    onEditIssue: affiliateListMode ? undefined : card.handleEditIssue,
    onEditComment: affiliateListMode ? undefined : card.handleEditComment,
    onOpenGitHubIssueInOrca:
      card.hoverIssue && 'url' in card.hoverIssue && card.hoverIssue.url
        ? card.handleOpenGitHubIssueInOrca
        : undefined,
    onOpenIssueInBrowser:
      card.hoverIssue && 'url' in card.hoverIssue && card.hoverIssue.url
        ? card.handleOpenIssueInBrowser
        : undefined,
    onOpenLinearIssueInOrca: linearIssue?.url ? card.handleOpenLinearIssueInOrca : undefined,
    onOpenReviewInOrca: repo ? card.handleOpenReviewInOrca : undefined,
    onOpenReviewInBrowser: card.hoverReview?.url ? card.handleOpenReviewInBrowser : undefined,
    onOpenAutomation: affiliateListMode ? undefined : card.handleOpenAutomation,
    onOpenAutomationRun: affiliateListMode ? undefined : card.handleOpenAutomationRun,
    onUnlinkReview:
      !affiliateListMode &&
      (card.canUnlinkReview ||
        getWorkspaceAttachments(worktree).some((item) => item.type !== 'issue'))
        ? card.handleUnlinkReview
        : undefined
  }
}

/** The task number, which opens the row's details card on hover and the task on click. */
export function WorktreeCardTaskKeyHover({
  card,
  presentation,
  placement = 'title'
}: {
  card: WorktreeCardController
  presentation: WorktreeCardPresentation
  placement?: 'title' | 'meta'
}): React.JSX.Element | null {
  const { worktree, titleRenaming, taskKeyHoverControl } = card
  if (!worktree.buildWebTask?.key) {
    return null
  }
  const key = (
    <WorktreeTaskKey
      worktree={worktree}
      placement={placement}
      onOpen={taskKeyHoverControl.closeHover}
    />
  )
  if (titleRenaming) {
    return key
  }
  return (
    <WorktreeCardDetailsHover
      {...workspaceDetailsProps(card, presentation)}
      openDelay={TASK_KEY_DETAILS_OPEN_DELAY_MS}
      hoverControl={taskKeyHoverControl}
    >
      {key}
    </WorktreeCardDetailsHover>
  )
}

/**
 * The «Project on <host>» element. Its card names the host and lists the workspace's live ports;
 * on a task row it carries the details as well. With neither, it stays the plain tooltip.
 */
export function WorktreeCardHostHover({
  card,
  presentation,
  heading,
  icon,
  children
}: {
  card: WorktreeCardController
  presentation: WorktreeCardPresentation
  /** «Project on dev», or the host's disconnected sentence. */
  heading: string
  icon: React.ReactNode
  children: React.ReactElement
}): React.JSX.Element {
  const { worktree, workspacePorts, hostHoverControl, titleRenaming } = card
  const hasTask = Boolean(worktree.buildWebTask?.key)
  const ports =
    workspacePorts.length > 0 ? <WorktreeCardPortsDetails ports={workspacePorts} /> : null
  if ((!hasTask && !ports) || titleRenaming) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {heading}
        </TooltipContent>
      </Tooltip>
    )
  }
  return (
    <WorktreeCardDetailsHover
      {...(hasTask ? workspaceDetailsProps(card, presentation) : NO_DETAILS)}
      detailsBefore={
        <div
          className="flex min-w-0 items-center gap-1.5 text-muted-foreground"
          data-worktree-host-hover-heading=""
        >
          {icon}
          <span className="min-w-0 truncate">{heading}</span>
        </div>
      }
      detailsAfter={ports}
      hoverControl={hostHoverControl}
    >
      {children}
    </WorktreeCardDetailsHover>
  )
}

/** Where a row's project lives, as its «Project on …» element names it. */
export function describeWorktreeCardHost(card: WorktreeCardController): {
  label: string
  heading: string
  disconnected: boolean
  Icon: typeof Server
} {
  const { worktree, repo, parsedRepoHost, runtimeHostLabel, isRuntimeDisconnected } = card
  if (repo?.connectionId) {
    const label = card.sshTargetLabel || repo.displayName
    return {
      label,
      heading: translate(
        'auto.components.sidebar.WorktreeCardSshHostControl.connectedName',
        'Project on SSH host {{value0}}',
        { value0: label }
      ),
      disconnected: card.isSshDisconnected,
      Icon: card.isSshDisconnected ? ServerOff : Server
    }
  }
  if (parsedRepoHost?.kind === 'runtime' || worktree.runtimeOwnerEnvironmentId) {
    const label =
      runtimeHostLabel ??
      translate('auto.components.sidebar.WorktreeCard.runtimeHostFallbackLabel', 'Orca server')
    const heading = isRuntimeDisconnected
      ? runtimeHostLabel
        ? translate(
            'auto.components.sidebar.WorktreeCard.runtimeHostDisconnectedNamed',
            '{{hostName}} disconnected',
            { hostName: runtimeHostLabel }
          )
        : translate(
            'auto.components.sidebar.WorktreeCard.runtimeHostDisconnected',
            'Server disconnected'
          )
      : runtimeHostLabel
        ? translate(
            'auto.components.sidebar.WorktreeCard.runtimeHostProjectNamed',
            'Project on {{hostName}}',
            { hostName: runtimeHostLabel }
          )
        : translate(
            'auto.components.sidebar.WorktreeCard.runtimeHostProject',
            'Project on Orca server'
          )
    return {
      label,
      heading,
      disconnected: isRuntimeDisconnected,
      Icon: isRuntimeDisconnected ? ServerOff : Server
    }
  }
  const label = getLocalExecutionHostLabel()
  return {
    label,
    heading: translate(
      'auto.components.sidebar.WorktreeCard.runtimeHostProjectNamed',
      'Project on {{hostName}}',
      { hostName: label }
    ),
    disconnected: false,
    Icon: Laptop
  }
}

/** The host in an opened compact row's second line: its icon and name, and its card on hover. */
export function WorktreeCardCompactHost({
  card,
  presentation
}: {
  card: WorktreeCardController
  presentation: WorktreeCardPresentation
}): React.JSX.Element {
  const host = describeWorktreeCardHost(card)
  const iconClassName = cn('size-[11px] shrink-0', host.disconnected && 'text-destructive')
  return (
    <WorktreeCardHostHover
      card={card}
      presentation={presentation}
      heading={host.heading}
      icon={<host.Icon className={cn('size-3', host.disconnected && 'text-destructive')} />}
    >
      <span
        className="inline-flex min-w-0 shrink items-center gap-[3px]"
        data-worktree-card-host=""
      >
        <host.Icon className={iconClassName} aria-hidden />
        <span className="min-w-0 truncate">{host.label}</span>
      </span>
    </WorktreeCardHostHover>
  )
}
