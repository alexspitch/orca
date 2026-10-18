import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { activateAndRevealWorktree } from '@/lib/worktree-activation'
import type { RuntimeGitContext } from '@/runtime/runtime-git-client-context'
import { errorMessage } from '../../../../shared/error-message'
import type { GitHistoryItem } from '../../../../shared/git-history'
import type { GitBranchChangeEntry } from '../../../../shared/git-diff-compare-types'
import type { Worktree } from '../../../../shared/worktree/types'
import { useGitHistoryCommitActions } from '../right-sidebar/source-control/sync/use-git-history-commit-actions'
import type { GitHistoryCommitAction } from '../right-sidebar/source-control/sync/git-history-commit-context-menu'
import { shortGitRefName } from '../../../../shared/git-log-page'
import { getRuntimeGitCommitDiff } from '@/runtime/runtime-git-diff-client'
import { collectGitLogGroupKeys, gitLogToggledForAll } from './git-log-branch-tree'
import {
  EMPTY_GIT_LOG_FILTERS,
  gitLogFiltersBreakGraph,
  type GitLogFilters
} from './git-log-filters'
import {
  GIT_LOG_BRANCHES_MIN_WIDTH,
  GIT_LOG_DETAILS_MIN_WIDTH,
  readGitLogViewPrefs,
  writeGitLogRepoView,
  writeGitLogViewPrefs
} from './git-log-view-prefs'
import {
  gitLogBranchSections,
  gitLogHeadCommits,
  gitLogLineage,
  gitLogUserSections,
  gitLogViewModels
} from './git-log-workspace-model'
import { useGitLogData } from './use-git-log-data'
import { GitLogBranchesPane } from './GitLogBranchesPane'
import { GitLogCommitContextMenu } from './GitLogCommitContextMenu'
import { GitLogDetailsColumn } from './GitLogDetailsColumn'
import { GitLogFilterBar } from './GitLogFilterBar'
import { GitLogIconStrip } from './GitLogIconStrip'
import { GitLogPaneSplit } from './GitLogPaneSplit'
import { GitLogTable } from './GitLogTable'
import { GitLogDiffDialog, type GitLogDiffTarget } from './GitLogDiffDialog'
import { GitLogLogNotices } from './GitLogLogNotices'
import { buildGitLogCommitTree, gitLogFilesInTreeOrder } from './git-log-commit-files'
import type { GitLogCommitActionId } from './git-log-menus'
import { useGitLogActions } from './use-git-log-actions'

const NO_SPLIT_TARGET = (): undefined => undefined

/** Branches | log | changes + details for one worktree's repository, as WebStorm's Git › Log. */
export function GitLogWorkspace({
  worktree,
  worktrees,
  onPickWorktree,
  context
}: {
  worktree: Worktree
  /** The project's worktrees, offered when a branch to check out is held by one of them. */
  worktrees: readonly Worktree[]
  onPickWorktree: (worktreeId: string) => void
  context: RuntimeGitContext
}): React.JSX.Element {
  const [prefs] = useState(readGitLogViewPrefs)
  // What this project showed last time: Branch filter, commit and file.
  const saved = prefs.viewByRepo[worktree.repoId]
  const [filters, setFilters] = useState<GitLogFilters>({
    ...EMPTY_GIT_LOG_FILTERS,
    branch: saved?.branch ?? null
  })
  const [selectedId, setSelectedId] = useState<string | null>(saved?.commitId ?? null)
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(saved?.filePath ?? null)
  const [diffTarget, setDiffTarget] = useState<GitLogDiffTarget | null>(null)
  const [branchesHidden, setBranchesHidden] = useState(prefs.branchesHidden)
  const [branchesWidth, setBranchesWidth] = useState(prefs.branchesWidth)
  const [detailsWidth, setDetailsWidth] = useState(prefs.detailsWidth)
  const [groupByDirectory, setGroupByDirectory] = useState(true)
  const [toggled, setToggled] = useState<ReadonlySet<string>>(new Set())

  const data = useGitLogData(context, filters, `${worktree.head}|${worktree.branch}`)
  const page = data.log.rows
  const items = useMemo(() => page?.items ?? [], [page])
  const currentRef = page?.currentRef
  const viewModels = useMemo(
    () => gitLogViewModels(items, currentRef, !gitLogFiltersBreakGraph(filters)),
    [currentRef, filters, items]
  )
  const headCommits = useMemo(
    () => gitLogHeadCommits(items, currentRef?.revision),
    [currentRef?.revision, items]
  )
  const selected = items.find((item) => item.id === selectedId) ?? items[0] ?? null
  // Why remembered: once an author filter applies, the loaded commits name only that author.
  const [knownAuthors, setKnownAuthors] = useState<ReadonlySet<string>>(new Set())
  useEffect(() => {
    setKnownAuthors((current) => {
      const missing = items.filter((item) => item.author && !current.has(item.author))
      return missing.length === 0
        ? current
        : new Set([...current, ...missing.flatMap((item) => (item.author ? [item.author] : []))])
    })
  }, [items])

  useEffect(() => {
    writeGitLogRepoView(worktree.repoId, {
      branch: filters.branch,
      commitId: selectedId,
      filePath: selectedFilePath
    })
  }, [filters.branch, selectedFilePath, selectedId, worktree.repoId])
  const selectCommit = (commitId: string) => {
    if (commitId !== selectedId) {
      setSelectedId(commitId)
      setSelectedFilePath(null)
    }
  }

  const actions = useGitHistoryCommitActions({
    activeWorktreeId: worktree.id,
    worktreePath: worktree.path,
    activeRepoTarget: context.target,
    resolveSplitTargetGroupId: NO_SPLIT_TARGET
  })
  // Why activate first: the diff opens as a tab of this worktree, which the workspace view shows.
  const openFile = useCallback(
    (item: GitHistoryItem, entry: GitBranchChangeEntry) => {
      activateAndRevealWorktree(worktree.id)
      actions.openCommitFile(item, entry)
    },
    [actions, worktree.id]
  )
  const showDiff = (item: GitHistoryItem, files: GitBranchChangeEntry[], index: number) => {
    const entry = files[index]
    if (!entry) {
      return
    }
    setSelectedFilePath(entry.path)
    setDiffTarget({
      key: `commit:${item.id}`,
      subtitle: `${item.displayId ?? item.id.slice(0, 8)} ${item.subject}`,
      files,
      index,
      load: (file) =>
        getRuntimeGitCommitDiff(context, {
          commitOid: item.id,
          parentOid: item.parentIds[0] ?? null,
          filePath: file.path,
          oldPath: file.oldPath
        }),
      openInEditor: (file) => {
        setDiffTarget(null)
        openFile(item, file)
      }
    })
  }
  // Enter or a double click on a commit opens its first file, as the Changes pane would.
  const shownIdRef = useRef(selected?.id)
  shownIdRef.current = selected?.id
  const showCommitDiff = (item: GitHistoryItem) => {
    selectCommit(item.id)
    void actions.loadCommitFiles(item).then(
      // Why checked: the selection may have moved on while the files loaded.
      (entries) =>
        shownIdRef.current === item.id &&
        showDiff(item, gitLogFilesInTreeOrder(buildGitLogCommitTree(entries)), 0),
      (error: unknown) =>
        toast.error(translate('gitLog.diff.filesFailed', 'Couldn’t load the commit’s files'), {
          description: errorMessage(error)
        })
    )
  }
  // Why activate first: the browser tab or the agent opens inside this worktree; show it.
  const onCommitAction = useCallback(
    (action: GitHistoryCommitAction, item: GitHistoryItem) => {
      if (action === 'open-remote' || action === 'explain') {
        activateAndRevealWorktree(worktree.id)
      }
      actions.handleCommitAction(action, item)
    },
    [actions, worktree.id]
  )
  const { parentOf, childOf } = useMemo(() => gitLogLineage(items), [items])

  const refs = data.refs.data
  const refsUnsupported = data.refs.unsupported
  const currentBranch = currentRef?.category === 'branches' ? currentRef.name : null
  const fetchWorktrees = useAppStore((s) => s.fetchWorktrees)
  const { refresh } = data
  const repoId = worktree.repoId
  // Why fetchWorktrees too: the sidebar and the log's HEAD key read the worktree's branch from it.
  const onChanged = useCallback(() => {
    refresh()
    void fetchWorktrees(repoId)
  }, [fetchWorktrees, refresh, repoId])
  const ops = useGitLogActions({
    context,
    repoId,
    worktreePath: worktree.path,
    worktrees,
    onPickWorktree,
    currentBranch,
    headOid: currentRef?.revision ?? worktree.head ?? null,
    onChanged,
    onShowDiff: setDiffTarget
  })
  const selectedRef =
    filters.branch === 'HEAD'
      ? (refs?.refs.find((ref) => ref.isHead) ?? null)
      : (refs?.refs.find((ref) => ref.fullName === filters.branch) ?? null)
  // A deleted or renamed branch can't stay the filter; dropped during render, with no stale frame.
  if (refs && !data.refs.loading && filters.branch && filters.branch !== 'HEAD' && !selectedRef) {
    setFilters({ ...filters, branch: null })
  }
  const onCommitMenu = (action: GitLogCommitActionId, item: GitHistoryItem) => {
    if (action === 'copyRevision') {
      onCommitAction('copy-hash', item)
    } else if (action === 'openInBrowser') {
      onCommitAction('open-remote', item)
    } else if (action === 'explain') {
      onCommitAction('explain', item)
    } else if (action === 'child' || action === 'parent') {
      const target = action === 'child' ? childOf(item) : parentOf(item)
      if (target) {
        selectCommit(target)
      }
    } else {
      ops.runCommitAction(action, item)
    }
  }
  const setAllGroups = (expanded: boolean) =>
    setToggled(
      gitLogToggledForAll(collectGitLogGroupKeys(refs?.refs ?? [], groupByDirectory), expanded)
    )
  const toggleGroup = (key: string) =>
    setToggled((current) => {
      const next = new Set(current)
      if (!next.delete(key)) {
        next.add(key)
      }
      return next
    })

  const emptyLabel =
    items.length > 0 || data.log.loading
      ? null
      : (data.log.error ?? translate('gitLog.table.empty', 'No commits match these filters'))

  const logColumn = (
    <>
      <GitLogFilterBar
        filters={filters}
        onChange={setFilters}
        branchSections={gitLogBranchSections(refs, filters.branch)}
        branchLabel={filters.branch ? shortGitRefName(filters.branch) : null}
        userSections={gitLogUserSections(refs?.userName, knownAuthors)}
        loading={data.log.loading}
        onRefresh={refresh}
        onCherryPick={
          ops.canWrite ? () => selected && ops.runCommitAction('cherryPick', selected) : undefined
        }
        canCherryPick={selected !== null && !ops.busy}
      />
      <GitLogLogNotices page={page} error={items.length > 0 ? data.log.error : null} />
      <GitLogTable
        items={items}
        viewModels={viewModels}
        headCommits={headCommits}
        selectedId={selected?.id ?? null}
        onSelect={(item) => selectCommit(item.id)}
        onOpen={showCommitDiff}
        hasMore={page?.hasMore === true && !page.capped}
        loading={data.log.loading}
        loadingMore={data.log.loadingMore}
        onLoadMore={data.loadMore}
        emptyLabel={emptyLabel}
        renderContextMenu={(item) => (
          <GitLogCommitContextMenu
            item={item}
            canWrite={ops.canWrite}
            onSelect={(action) => onCommitMenu(action, item)}
            childId={childOf(item)}
            parentId={parentOf(item)}
          />
        )}
      />
    </>
  )

  const detailsColumn = (
    <GitLogDetailsColumn
      initialShare={prefs.filesShare}
      item={selected}
      context={context}
      loadCommitFiles={actions.loadCommitFiles}
      onShowDiff={showDiff}
      selectedPath={selectedFilePath}
      onSelectPath={setSelectedFilePath}
    />
  )

  const logAndDetails = (
    <GitLogPaneSplit
      side="right"
      width={detailsWidth}
      minWidth={GIT_LOG_DETAILS_MIN_WIDTH}
      maxWidth={1200}
      onWidthChange={(width) => {
        setDetailsWidth(width)
        writeGitLogViewPrefs({ detailsWidth: width })
      }}
      aside={detailsColumn}
    >
      {logColumn}
    </GitLogPaneSplit>
  )

  return (
    <div className="flex min-h-0 flex-1">
      <GitLogDiffDialog
        target={diffTarget}
        worktreePath={worktree.path}
        onGoToFile={(index) => {
          const entry = diffTarget?.files[index]
          if (diffTarget && entry) {
            // Only a commit's own diff follows the Changes pane; comparisons have other files.
            if (diffTarget.key.startsWith('commit:')) {
              setSelectedFilePath(entry.path)
            }
            setDiffTarget({ ...diffTarget, index })
          }
        }}
        onClose={() => setDiffTarget(null)}
      />
      {ops.dialogs}
      <GitLogIconStrip
        branchesShown={!branchesHidden}
        onToggleBranches={() => {
          setBranchesHidden(!branchesHidden)
          writeGitLogViewPrefs({ branchesHidden: !branchesHidden })
        }}
        groupByDirectory={groupByDirectory}
        onToggleGroupByDirectory={() => setGroupByDirectory(!groupByDirectory)}
        onExpandAll={() => setAllGroups(true)}
        onCollapseAll={() => setAllGroups(false)}
        selectedRef={selectedRef}
        currentBranch={currentBranch}
        canWrite={ops.canWrite}
        favorite={selectedRef !== null && ops.isFavorite(selectedRef)}
        onNewBranch={() =>
          selectedRef ? ops.runBranchAction('newBranch', selectedRef) : ops.newBranchFromHead()
        }
        onBranchAction={ops.runBranchAction}
        onFetch={ops.fetchAll}
        onToggleFavorite={() => selectedRef && ops.toggleFavorite(selectedRef)}
        onNavigate={() => selectedRef && selectCommit(selectedRef.oid)}
      />
      {branchesHidden ? (
        logAndDetails
      ) : (
        <GitLogPaneSplit
          side="left"
          width={branchesWidth}
          minWidth={GIT_LOG_BRANCHES_MIN_WIDTH}
          maxWidth={600}
          onWidthChange={(width) => {
            setBranchesWidth(width)
            writeGitLogViewPrefs({ branchesWidth: width })
          }}
          aside={
            <GitLogBranchesPane
              refs={refs}
              loading={data.refs.loading}
              error={data.refs.error}
              unsupported={refsUnsupported}
              activeRef={filters.branch}
              onFilterRef={(branch) => setFilters((current) => ({ ...current, branch }))}
              groupByDirectory={groupByDirectory}
              toggled={toggled}
              onToggle={toggleGroup}
              currentBranch={currentBranch}
              canWrite={ops.canWrite}
              onBranchAction={ops.runBranchAction}
              isFavorite={ops.isFavorite}
            />
          }
        >
          {logAndDetails}
        </GitLogPaneSplit>
      )}
    </div>
  )
}
