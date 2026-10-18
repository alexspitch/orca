import type { GitHistoryItem, GitHistoryItemRef } from '../../../../shared/git-history'
import {
  buildDefaultGitHistoryColorMap,
  buildGitHistoryViewModels,
  type GitHistoryItemViewModel
} from '../../../../shared/git-history-graph'
import type { GitRefsResult } from '../../../../shared/git-log-page-types'
import { translate } from '@/i18n/i18n'
import { shortGitRefName } from '../../../../shared/git-log-page'
import { isGitLogFavoriteRef } from './git-log-branch-tree'
import type { GitLogFilterSection } from './GitLogFilterBar'

const MAX_BRANCH_OPTIONS = 15
const MAX_AUTHOR_OPTIONS = 20

/**
 * Rows for the graph. While a filter drops commits the edges would be wrong, so each row is a
 * lone dot — the same `GitHistoryGraphSvg`, fed a parentless view model.
 */
export function gitLogViewModels(
  items: readonly GitHistoryItem[],
  currentRef: GitHistoryItemRef | undefined,
  withEdges: boolean
): GitHistoryItemViewModel[] {
  if (withEdges) {
    return buildGitHistoryViewModels(
      [...items],
      buildDefaultGitHistoryColorMap({ currentRef }),
      currentRef
    )
  }
  return items.map((item) => ({
    historyItem: { ...item, parentIds: [] },
    inputSwimlanes: [],
    outputSwimlanes: [],
    kind: item.id === currentRef?.revision ? 'HEAD' : 'node'
  }))
}

/** Loaded commits reachable from HEAD, for WebStorm's tint of the current branch's rows. */
export function gitLogHeadCommits(
  items: readonly GitHistoryItem[],
  headOid: string | undefined
): Set<string> {
  const byId = new Map(items.map((item) => [item.id, item]))
  const reached = new Set<string>()
  const queue = headOid ? [headOid] : []
  while (queue.length > 0) {
    const id = queue.pop()!
    const item = byId.get(id)
    if (!item || reached.has(id)) {
      continue
    }
    reached.add(id)
    queue.push(...item.parentIds)
  }
  return reached
}

export function gitLogBranchSections(
  refs: GitRefsResult | null,
  activeBranch: string | null
): GitLogFilterSection[] {
  const all = refs?.refs ?? []
  // Values are full ref names, as the branch tree's: a short name can mean a tag.
  const pick = (kind: 'local' | 'remote') =>
    all
      .filter((ref) => ref.kind === kind && (kind === 'local' || isGitLogFavoriteRef(ref)))
      .sort(
        (a, b) =>
          Number(isGitLogFavoriteRef(b)) - Number(isGitLogFavoriteRef(a)) ||
          a.shortName.localeCompare(b.shortName)
      )
      .slice(0, MAX_BRANCH_OPTIONS)
      .map((ref) => ({ value: ref.fullName, label: ref.shortName }))
  const local = pick('local')
  const remote = pick('remote')
  const listed = new Set([...local, ...remote].map((option) => option.value))
  const extra =
    activeBranch && activeBranch !== 'HEAD' && !listed.has(activeBranch)
      ? [{ value: activeBranch, label: shortGitRefName(activeBranch) }]
      : []
  return [
    {
      id: 'head',
      options: [
        {
          value: 'HEAD',
          label: translate('gitLog.branches.head', 'HEAD (Current Branch)')
        },
        ...extra
      ]
    },
    { id: 'local', title: translate('gitLog.branches.local', 'Local'), options: local },
    { id: 'remote', title: translate('gitLog.branches.remote', 'Remote'), options: remote }
  ]
}

export function gitLogUserSections(
  userName: string | undefined,
  authors: ReadonlySet<string>
): GitLogFilterSection[] {
  const others = [...authors]
    .filter((name) => name !== userName)
    .sort((a, b) => a.localeCompare(b))
    .slice(0, MAX_AUTHOR_OPTIONS)
  return [
    {
      id: 'me',
      options: userName ? [{ value: userName, label: translate('gitLog.filter.me', 'me') }] : []
    },
    { id: 'authors', options: others.map((name) => ({ value: name, label: name })) }
  ]
}

/** Go to Child/Parent among the loaded commits, without a scan per row. */
export function gitLogLineage(items: readonly GitHistoryItem[]): {
  parentOf: (item: GitHistoryItem) => string | null
  childOf: (item: GitHistoryItem) => string | null
} {
  const loaded = new Set(items.map((item) => item.id))
  const childById = new Map<string, string>()
  for (const item of items) {
    for (const parent of item.parentIds) {
      if (!childById.has(parent)) {
        childById.set(parent, item.id)
      }
    }
  }
  return {
    parentOf: (item) => item.parentIds.find((id) => loaded.has(id)) ?? null,
    childOf: (item) => childById.get(item.id) ?? null
  }
}
