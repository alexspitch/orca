import React from 'react'

import { cn } from '@/lib/utils'
import { getWorkspaceAttachments } from '../../../../shared/workspace-attachments'
import { WorktreeCardCompactDetails } from './worktree-card-compact-details'
import { WorktreeCardHeader } from './worktree-card-header'
import { WorktreeCardMetaRow } from './worktree-card-meta-row'
import type { WorktreeCardPresentation } from './worktree-card-presentation'
import { WorktreeCardSecondaryRows } from './worktree-card-secondary-rows'
import { WorktreeCardStatusSlot } from './WorktreeCardStatusSlot'
import type { WorktreeCardController } from './use-worktree-card-controller'

export function WorktreeCardParentContent({
  card,
  presentation
}: {
  card: WorktreeCardController
  presentation: WorktreeCardPresentation
}): React.JSX.Element {
  const {
    worktree,
    affiliateListMode,
    newCardStyle,
    showStatus,
    unreadTooltip,
    stopQuickActionPointerPropagation,
    handleToggleUnreadQuick,
    statusLaneReview,
    reviewChecks,
    branchIdentityDisplay,
    showInlineAgentList
  } = card
  const {
    titleOnlyCard,
    parentContentMarginLeft,
    showCombinedStatusSlot,
    showUnreadQuickAction,
    compactRowShape
  } = presentation

  // Why no hover card on the body: the number and the «Project on …» element open theirs (IS-147).
  const identityContent = (
    <div
      className={cn(
        'group/worktree-card flex w-full min-w-0 flex-col',
        compactRowShape ? 'gap-0.5' : 'gap-1.5'
      )}
      data-worktree-card-hover-trigger=""
    >
      <WorktreeCardHeader card={card} presentation={presentation} />
      {presentation.hasMetaRow && <WorktreeCardMetaRow card={card} presentation={presentation} />}
    </div>
  )

  return (
    <div
      className={cn(
        'flex w-full min-w-0 pl-0',
        compactRowShape ? 'gap-1.5' : 'gap-0.5',
        compactRowShape === 'line' || (!compactRowShape && titleOnlyCard)
          ? 'items-center'
          : 'items-start'
      )}
      style={
        parentContentMarginLeft < 0 ? { marginLeft: `${parentContentMarginLeft}px` } : undefined
      }
      data-worktree-card-parent-content=""
    >
      {showCombinedStatusSlot ? (
        <div
          className={cn(
            'flex shrink-0 justify-center',
            compactRowShape
              ? 'h-[18px] w-4 items-center'
              : newCardStyle
                ? 'mr-1 w-5 items-center'
                : 'items-start pt-[2px]',
            affiliateListMode && 'px-1'
          )}
          data-worktree-card-status-slot=""
        >
          <WorktreeCardStatusSlot
            worktreeId={worktree.id}
            showStatus={showStatus}
            showUnreadAction={showUnreadQuickAction}
            isUnread={worktree.isUnread}
            unreadTooltip={unreadTooltip}
            onPointerDown={stopQuickActionPointerPropagation}
            onToggleUnread={handleToggleUnreadQuick}
            prDisplay={statusLaneReview}
            reviewChecks={reviewChecks.total > 0 ? reviewChecks : undefined}
            newCardStyle={newCardStyle}
            hasBranchIdentity={Boolean(branchIdentityDisplay)}
          />
        </div>
      ) : null}

      <div
        className={cn(
          'flex min-w-0 flex-1 flex-col',
          compactRowShape ? 'gap-0.5' : 'gap-1.5',
          // Why: inline agent rows intentionally outdent into the card gutter; inner elements handle truncation.
          showInlineAgentList || getWorkspaceAttachments(worktree).length > 1
            ? 'overflow-visible'
            : 'overflow-hidden'
        )}
      >
        {identityContent}
        <WorktreeCardSecondaryRows card={card} presentation={presentation} />
        {compactRowShape === 'open' ? (
          <WorktreeCardCompactDetails card={card} presentation={presentation} />
        ) : null}
      </div>
    </div>
  )
}
