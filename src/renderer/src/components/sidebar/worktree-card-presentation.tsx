import React from 'react'
import { getWorkspaceAttachments } from '../../../../shared/workspace-attachments'

import {
  getFlushWorktreeCardPaddingLeft,
  getNewCardStyleParentContentMarginLeft
} from './worktree-list/rows/indentation'
import {
  hasWorktreeCardDetails,
  WorktreeCardDetailsHover,
  WorktreeCardMetaBadges
} from './WorktreeCardMeta'
import { WorktreeCardPortsDetails, WorktreeCardPortsTrigger } from './WorktreeCardPorts'
import type { WorktreeCardController } from './use-worktree-card-controller'
import { getWorktreeTaskSessionState } from '../../../../shared/sidebar-list/task-session-groups'

function getVisibleContextLabel(
  projectLabel: string | undefined,
  hostLabel: string | undefined,
  showHost: boolean
): string | undefined {
  const labels = [projectLabel, showHost ? hostLabel : undefined].filter(Boolean)
  return labels.length > 0 ? labels.join(' · ') : undefined
}

export function buildWorktreeCardPresentation(card: WorktreeCardController) {
  const {
    worktree,
    repo,
    inPinnedSection,
    hideRepoBadge,
    hostContextLabel,
    showProjectName,
    affiliateListMode,
    flushSurface,
    contentIndent,
    newCardStyle,
    compactCards,
    isFolder,
    detachedHeadDisplay,
    branch,
    identityDisplay,
    folderMetaRowContent,
    showIdentityInNewCard,
    conflictOperation,
    cardProps,
    cardDetails,
    cacheStartedAt,
    hasDetails,
    hasPorts,
    showStatus,
    showInlineAgentList,
    showLineageChildChip,
    remoteBranchConflict,
    visibleCardTitle,
    workspacePorts,
    referenceDetails,
    showPR,
    showIssue,
    showLinearIssue,
    showJiraIssue,
    metaIssue,
    metaLinearIssue,
    metaJiraIssue,
    metaReview,
    metaComment,
    metaAutomationProvenance,
    metaCliProvenance,
    hoverIssue,
    hoverLinearIssue,
    hoverJiraIssue,
    hoverReview,
    hoverComment,
    linearIssue,
    handleEditIssue,
    handleManageLinks,
    handleEditComment,
    handleOpenGitHubIssueInOrca,
    handleOpenIssueInBrowser,
    handleOpenLinearIssueInOrca,
    handleOpenReviewInOrca,
    handleOpenReviewInBrowser,
    handleOpenAutomation,
    handleOpenAutomationRun,
    canUnlinkReview,
    handleUnlinkReview,
    detailsHoverControl,
    showDeleteQuickAction
  } = card

  // Why: pinned trees mix repos, so ordinary rows lead with the project chip; cross-repo children keep the regular project badge.
  // Why a task's compact row drops the chip: its number names the work, and the title needs the room.
  const taskNumberLeads = cardDetails.compactCards && Boolean(worktree.buildWebTask)
  // Why the meta row on a full card: the number sits where a linked Jira issue does (IS-147).
  const showTaskKeyInMetaRow =
    !compactCards && !newCardStyle && cardDetails.metaRow && Boolean(worktree.buildWebTask)
  const showPinnedRepoIcon = inPinnedSection && !!repo && !showProjectName && !taskNumberLeads
  const showInlineRepoBadge =
    cardDetails.repoInTitle &&
    !!repo &&
    !hideRepoBadge &&
    !isFolder &&
    !showPinnedRepoIcon &&
    !taskNumberLeads
  const showRepoBadgeInMetaRow =
    !cardDetails.repoInTitle && !!repo && !hideRepoBadge && !showPinnedRepoIcon
  const contextLabel = getVisibleContextLabel(
    undefined,
    hostContextLabel,
    cardProps.includes('host')
  )
  const showHostContextBadge = !!contextLabel && (!compactCards || !!showProjectName)
  const showDetachedHeadInMetaRow = cardDetails.metaRow && !isFolder && detachedHeadDisplay !== null
  const showBranch =
    !isFolder &&
    branch.length > 0 &&
    !newCardStyle &&
    (!compactCards || branch !== worktree.displayName)
  // Why: rebases already surface in source control, so dense cards skip the persistent rebase chip.
  const showConflictOperationBadge =
    !!conflictOperation && conflictOperation !== 'unknown' && conflictOperation !== 'rebase'
  const hasMetadataBadge = showConflictOperationBadge
  const showUnreadQuickAction = !affiliateListMode && showStatus && !newCardStyle
  // Why: the slot owns the unread/status lane; legacy keeps the bell toggle, the new card keeps the glyph passive.
  const showCombinedStatusSlot = showStatus
  const showTitleRowPrimary = compactCards && worktree.isMainWorktree && !isFolder
  const showMetaRowDetails = !newCardStyle && !compactCards && (hasDetails || hasPorts)
  const showTitleRowIndicators = (newCardStyle || compactCards) && (hasDetails || hasPorts)
  // Why: grouped views can hide the repo badge; don't reserve a blank metadata lane unless there's real content.
  const hasDetailedMetaRowContent = Boolean(
    (showRepoBadgeInMetaRow && repo) ||
    showHostContextBadge ||
    folderMetaRowContent ||
    showBranch ||
    showIdentityInNewCard ||
    showDetachedHeadInMetaRow ||
    showConflictOperationBadge ||
    cacheStartedAt != null ||
    showMetaRowDetails ||
    showTaskKeyInMetaRow
  )
  // Why: without the identity meta row, a compact card keeps a row only for badges and the timer.
  const hasMetaRow = cardDetails.metaRow
    ? hasDetailedMetaRowContent
    : hasMetadataBadge || cacheStartedAt != null
  const showHeaderActions = showTitleRowPrimary || showDeleteQuickAction
  const trimmedVisibleCardTitle = visibleCardTitle.trim()
  const showBranchIdentityHover = newCardStyle
    ? Boolean(identityDisplay) &&
      !cardProps.includes('branch') &&
      identityDisplay !== trimmedVisibleCardTitle
    : compactCards && showBranch
  const hoverBranchName = newCardStyle
    ? identityDisplay
    : showBranchIdentityHover
      ? branch
      : undefined
  const hoverWorkspaceTitle =
    trimmedVisibleCardTitle.length > 0 && trimmedVisibleCardTitle !== hoverBranchName
      ? trimmedVisibleCardTitle
      : undefined
  const hasHoverIdentity = Boolean(hoverWorkspaceTitle || hoverBranchName)
  const hasHoverDetails =
    (newCardStyle || compactCards) &&
    (getWorkspaceAttachments(worktree).length > 0 ||
      hasWorktreeCardDetails({
        issue: hoverIssue,
        linearIssue: hoverLinearIssue,
        jiraIssue: hoverJiraIssue,
        review: hoverReview,
        comment: hoverComment,
        automationProvenance: metaAutomationProvenance,
        cliProvenance: metaCliProvenance
      }) ||
      workspacePorts.length > 0 ||
      hasHoverIdentity)
  // Why: the parent row owns metadata hover; don't stack the title's truncation tooltip on the details popover.
  const titleWrapper = hasHoverDetails
    ? (title: React.ReactElement): React.ReactElement => title
    : undefined
  // Why: sidebar rows need a small surface inset while content stays aligned with the pre-inset layout.
  const applyNewCardStyleStatusLaneOffset = newCardStyle && showCombinedStatusSlot
  const cardPaddingLeft = flushSurface
    ? getFlushWorktreeCardPaddingLeft(contentIndent, applyNewCardStyleStatusLaneOffset)
    : contentIndent > 0
      ? `calc(0.125rem + ${contentIndent}px)`
      : null
  const parentContentMarginLeft =
    flushSurface && applyNewCardStyleStatusLaneOffset
      ? getNewCardStyleParentContentMarginLeft(contentIndent)
      : 0
  const cardStyle = cardPaddingLeft ? { paddingLeft: cardPaddingLeft } : undefined
  const allReferenceItems = getWorkspaceAttachments(worktree)
  const referenceItems = allReferenceItems.filter((item) =>
    item.type !== 'issue'
      ? showPR &&
        (!newCardStyle ||
          allReferenceItems.filter((candidate) => candidate.type !== 'issue').length > 1)
      : item.provider === 'linear'
        ? showLinearIssue
        : item.provider === 'jira'
          ? showJiraIssue
          : showIssue
  )
  const detailsAndPortsContent =
    hasDetails || hasPorts ? (
      <div className="flex shrink-0 items-center gap-1">
        {hasPorts && <WorktreeCardPortsTrigger ports={workspacePorts} />}
        {hasDetails && (
          <WorktreeCardMetaBadges
            linkedItemCount={allReferenceItems.length}
            referenceItems={referenceItems}
            referenceDetails={referenceDetails}
            issue={metaIssue}
            linearIssue={metaLinearIssue}
            jiraIssue={metaJiraIssue}
            review={newCardStyle ? null : metaReview}
            comment={metaComment}
            automationProvenance={metaAutomationProvenance}
            cliProvenance={metaCliProvenance}
            className="ml-0 pr-0"
          />
        )}
      </div>
    ) : null
  const detailsAndPorts =
    detailsAndPortsContent && !newCardStyle && !compactCards ? (
      <WorktreeCardDetailsHover
        workspace={worktree}
        referenceDetails={referenceDetails}
        onManageLinks={affiliateListMode ? undefined : handleManageLinks}
        issue={metaIssue}
        linearIssue={metaLinearIssue}
        jiraIssue={metaJiraIssue}
        review={metaReview}
        comment={metaComment}
        automationProvenance={metaAutomationProvenance}
        cliProvenance={metaCliProvenance}
        detailsAfter={hasPorts ? <WorktreeCardPortsDetails ports={workspacePorts} /> : null}
        hoverControl={detailsHoverControl}
        onEditIssue={affiliateListMode ? undefined : handleEditIssue}
        onEditComment={affiliateListMode ? undefined : handleEditComment}
        onOpenGitHubIssueInOrca={
          metaIssue && 'url' in metaIssue && metaIssue.url ? handleOpenGitHubIssueInOrca : undefined
        }
        onOpenIssueInBrowser={
          metaIssue && 'url' in metaIssue && metaIssue.url ? handleOpenIssueInBrowser : undefined
        }
        onOpenLinearIssueInOrca={linearIssue?.url ? handleOpenLinearIssueInOrca : undefined}
        onOpenReviewInOrca={repo ? handleOpenReviewInOrca : undefined}
        onOpenReviewInBrowser={metaReview?.url ? handleOpenReviewInBrowser : undefined}
        onOpenAutomation={affiliateListMode ? undefined : handleOpenAutomation}
        onOpenAutomationRun={affiliateListMode ? undefined : handleOpenAutomationRun}
        onUnlinkReview={
          !affiliateListMode &&
          (canUnlinkReview ||
            getWorkspaceAttachments(worktree).some((item) => item.type !== 'issue'))
            ? handleUnlinkReview
            : undefined
        }
      >
        {detailsAndPortsContent}
      </WorktreeCardDetailsHover>
    ) : (
      detailsAndPortsContent
    )
  const titleRowIndicators = showTitleRowIndicators ? (
    <div className="flex shrink-0 items-center gap-1">{detailsAndPorts}</div>
  ) : null
  // Why: the reason line under a Needs attention row is a second line; the status dot stays on the title.
  const showsAttentionReason =
    card.inTaskAttentionSection === true && getWorktreeTaskSessionState(worktree) === 'attention'
  const hasSecondaryCardContent =
    hasMetaRow ||
    !!remoteBranchConflict ||
    showInlineAgentList ||
    showLineageChildChip ||
    showsAttentionReason
  const titleOnlyCard = !hasSecondaryCardContent

  return {
    showPinnedRepoIcon,
    showInlineRepoBadge,
    showRepoBadgeInMetaRow,
    showHostContextBadge,
    contextLabel,
    showIdentityInNewCard,
    showDetachedHeadInMetaRow,
    showBranch,
    showConflictOperationBadge,
    showUnreadQuickAction,
    showCombinedStatusSlot,
    showTitleRowPrimary,
    showMetaRowDetails,
    showTaskKeyInMetaRow,
    showTitleRowIndicators,
    hasMetaRow,
    showHeaderActions,
    showDeleteQuickAction,
    hoverBranchName,
    hoverWorkspaceTitle,
    hasHoverDetails,
    titleWrapper,
    parentContentMarginLeft,
    cardStyle,
    detailsAndPorts,
    titleRowIndicators,
    titleOnlyCard,
    expandedCompactRow: cardDetails.expanded
  }
}

export type WorktreeCardPresentation = ReturnType<typeof buildWorktreeCardPresentation>
