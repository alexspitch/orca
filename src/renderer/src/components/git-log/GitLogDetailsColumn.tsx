import React from 'react'
import { translate } from '@/i18n/i18n'
import type { RuntimeGitContext } from '@/runtime/runtime-git-client-context'
import type { GitHistoryItem } from '../../../../shared/git-history'
import type { GitBranchChangeEntry } from '../../../../shared/git-diff-compare-types'
import { writeGitLogViewPrefs } from './git-log-view-prefs'
import { useGitLogDetailsSplit } from './use-git-log-details-split'
import { GitLogChangesPane } from './GitLogChangesPane'
import { GitLogCommitDetails } from './GitLogCommitDetails'

/** The right column: the commit's changed files over its details, split by a draggable rule. */
export function GitLogDetailsColumn({
  initialShare,
  item,
  context,
  loadCommitFiles,
  onShowDiff,
  selectedPath,
  onSelectPath
}: {
  initialShare: number
  item: GitHistoryItem | null
  context: RuntimeGitContext
  loadCommitFiles: (item: GitHistoryItem) => Promise<GitBranchChangeEntry[]>
  onShowDiff: (item: GitHistoryItem, files: GitBranchChangeEntry[], index: number) => void
  selectedPath: string | null
  onSelectPath: (path: string) => void
}): React.JSX.Element {
  const split = useGitLogDetailsSplit(initialShare, (filesShare) =>
    writeGitLogViewPrefs({ filesShare })
  )
  return (
    <div ref={split.columnRef} className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-col" style={{ flex: `0 0 ${split.share * 100}%` }}>
        <GitLogChangesPane
          item={item}
          loadCommitFiles={loadCommitFiles}
          onShowDiff={onShowDiff}
          selectedPath={selectedPath}
          onSelectPath={onSelectPath}
        />
      </div>
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label={translate('gitLog.layout.resize', 'Resize panel')}
        tabIndex={0}
        onMouseDown={split.onRuleMouseDown}
        onKeyDown={split.onRuleKeyDown}
        className="relative h-px shrink-0 cursor-row-resize bg-border focus-visible:outline-none"
      >
        <div className="absolute inset-x-0 -top-[3px] -bottom-[3px] z-10 hover:bg-ring/30" />
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <GitLogCommitDetails item={item} context={context} />
      </div>
    </div>
  )
}
