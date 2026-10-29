import { getWorkspaceAttachments } from '../../../../shared/workspace-attachments'

import {
  getCompactWorktreeCardPaddingLeft,
  getFlushWorktreeCardPaddingLeft,
  getNewCardStyleParentContentMarginLeft
} from './worktree-list/rows/indentation'
import { WorktreeCardMetaBadges } from './WorktreeCardMeta'
import { WorktreeCardPortsTrigger } from './WorktreeCardPorts'
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
    showDeleteQuickAction
  } = card

  // Why: pinned trees mix repos, so ordinary rows lead with the project chip; cross-repo children keep the regular project badge.
  // Why a task's compact row drops the chip: its number names the work, and the title needs the room;
  // grouped «By task», every compact title line is the mockup's — the opened row names the project.
  const taskGroupedCompactRow = compactCards && card.inTaskGrouping === true
  const plainCompactTitle =
    taskGroupedCompactRow || (compactCards && Boolean(worktree.buildWebTask))
  // Why the meta row on a full card: the number sits where a linked Jira issue does (IS-147).
  const showTaskKeyInMetaRow =
    !compactCards && !newCardStyle && cardDetails.metaRow && Boolean(worktree.buildWebTask)
  const showPinnedRepoIcon = inPinnedSection && !!repo && !showProjectName && !plainCompactTitle
  const showInlineRepoBadge =
    cardDetails.repoInTitle &&
    !!repo &&
    !hideRepoBadge &&
    !isFolder &&
    !showPinnedRepoIcon &&
    !plainCompactTitle
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
  const showTitleRowPrimary =
    compactCards && worktree.isMainWorktree && !isFolder && !plainCompactTitle
  const showMetaRowDetails = !newCardStyle && !compactCards && (hasDetails || hasPorts)
  // Why not grouped «By task»: the mockup's title line ends with the session state alone.
  const showTitleRowIndicators =
    (newCardStyle || (compactCards && !taskGroupedCompactRow)) && (hasDetails || hasPorts)
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
  // Why: without the identity meta row, a compact card keeps a row only for badges and the timer;
  // an opened compact row draws its own line (WorktreeCardCompactDetails).
  const hasMetaRow = compactCards
    ? !cardDetails.expanded && (hasMetadataBadge || cacheStartedAt != null)
    : cardDetails.metaRow
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
  // Why: sidebar rows need a small surface inset while content stays aligned with the pre-inset layout.
  const applyNewCardStyleStatusLaneOffset = newCardStyle && showCombinedStatusSlot
  const cardPaddingLeft = compactCards
    ? getCompactWorktreeCardPaddingLeft(contentIndent)
    : flushSurface
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
  // Why no hover card: details open from the task number and the «Project on …» element only (IS-147).
  const detailsAndPorts = detailsAndPortsContent
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
  // Why three shapes: the mockup's one-line row, the attention box's two-line row, the opened row.
  const compactRowShape: 'line' | 'tight' | 'open' | null = !compactCards
    ? null
    : cardDetails.expanded
      ? 'open'
      : card.inTaskAttentionSection
        ? 'tight'
        : 'line'

  return {
    showPinnedRepoIcon,
    showInlineRepoBadge,
    plainCompactTitle,
    taskGroupedCompactRow,
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
    parentContentMarginLeft,
    cardStyle,
    detailsAndPorts,
    titleRowIndicators,
    titleOnlyCard,
    compactRowShape,
    expandedCompactRow: cardDetails.expanded
  }
}

export type WorktreeCardPresentation = ReturnType<typeof buildWorktreeCardPresentation>
