import { describe, expect, it } from 'vitest'
import type { Repo } from '../../../src/shared/repo-types'
import {
  filterWorkspaceRows,
  type WorkspaceRowFactReader,
  type WorkspaceRowFilters
} from '../../../src/shared/workspace-view/workspace-row-filters'
import {
  getWorkspaceRowKindFacts,
  isAutomationGeneratedWorkspace,
  isCliCreatedWorkspace,
  isDefaultBranchWorkspace,
  isDetachedHeadWorkspace
} from '../../../src/shared/worktree/workspace-kinds'
import type { Worktree as DesktopWorktree } from '../../../src/shared/worktree/types'
import type { WorktreeBuildWebSessionState } from '../../../src/shared/build-web-session-types'
import {
  HIDEABLE_TASK_SESSION_GROUPS,
  isTaskSessionAttention,
  type HideableTaskSessionGroup
} from '../../../src/shared/sidebar-list/task-session-groups'
import { filterWorktrees, type Worktree } from './workspace-list-sections'

// Compare all filter combinations with desktop facts mirrored here because mobile cannot resolve renderer aliases.

const repos: Repo[] = [
  { id: 'git', path: '/git', displayName: 'Git', badgeColor: '#000', addedAt: 0 },
  {
    id: 'folder-repo',
    path: '/f',
    displayName: 'Folder',
    badgeColor: '#000',
    addedAt: 0,
    kind: 'folder'
  }
]
const repoMap = new Map(repos.map((repo) => [repo.id, repo]))

type Fixture = DesktopWorktree & { sleeping: boolean; otherClient: boolean; folderWorkspace?: true }

function fixture(id: string, fields: Partial<Fixture> = {}): Fixture {
  return {
    id,
    repoId: 'git',
    path: `/w/${id}`,
    head: 'abc1234',
    branch: `refs/heads/${id}`,
    isBare: false,
    isMainWorktree: false,
    displayName: id,
    comment: '',
    linkedIssue: null,
    linkedPR: null,
    linkedLinearIssue: null,
    isArchived: false,
    isUnread: false,
    isPinned: false,
    sortOrder: 0,
    lastActivityAt: 0,
    sleeping: true,
    otherClient: false,
    ...fields
  }
}

// IS-147: a task with no state yet is unknown, so no session filter hides it.
function task(key: string, state?: WorktreeBuildWebSessionState): Partial<Fixture> {
  return {
    buildWebTask: { issueId: key, key, consoleHost: 'https://console', branch: key.toLowerCase() },
    ...(state ? { buildWebSession: { state, at: 0 } } : {})
  }
}

const FIXTURES: Fixture[] = [
  fixture('main', { isMainWorktree: true, branch: 'refs/heads/main' }),
  fixture('main-detached', { isMainWorktree: true, branch: '' }),
  fixture('provisioned', { isMainWorktree: true, ephemeralVmCheckoutMode: 'provisioned-root' }),
  fixture('awake', { sleeping: false }),
  fixture('automation', {
    sleeping: false,
    automationProvenance: {
      kind: 'created-by-automation',
      automationId: 'a',
      automationNameSnapshot: 'Nightly',
      automationRunId: 'r',
      automationRunTitleSnapshot: 'Run',
      createdAt: 0,
      executionTargetType: 'local',
      executionTargetId: 'local',
      projectId: 'p',
      hostId: 'local'
    }
  }),
  fixture('cli', { sleeping: false, cliProvenance: { kind: 'created-by-cli', createdAt: 0 } }),
  fixture('detached', { branch: '', sleeping: false }),
  fixture('other-client', { otherClient: true, sleeping: false }),
  fixture('archived', { isArchived: true, sleeping: false }),
  fixture('folder-root', { repoId: 'folder-repo', isMainWorktree: true, branch: '', head: '' }),
  fixture('folder:lane', {
    repoId: 'folder-workspace:group',
    branch: '',
    head: '',
    folderWorkspace: true
  }),
  fixture('task-active', { ...task('IS-1', 'active'), sleeping: false }),
  fixture('task-waiting', task('IS-2', 'waiting')),
  fixture('task-closing', { ...task('IS-3', 'closing'), sleeping: false }),
  fixture('task-unknown', task('IS-4')),
  fixture('task-attention', task('IS-5', 'attention')),
  fixture('task-attention-archived', { ...task('IS-6', 'attention'), isArchived: true })
]

/** The desktop's reader (desktop-workspace-row-facts.ts) for a host that reports tasks. */
const desktopFacts = (keepArchivedTaskAttention: boolean): WorkspaceRowFactReader<Fixture> => ({
  isArchived: (w) => w.isArchived && !(keepArchivedTaskAttention && isTaskSessionAttention(w)),
  isFolderWorkspace: (w) => w.folderWorkspace === true,
  repoId: (w) => w.repoId,
  hostId: () => 'local',
  isOtherClient: (w) => w.otherClient,
  isDefaultBranch: (w) => isDefaultBranchWorkspace(w, repoMap.get(w.repoId)),
  isAutomationCreated: isAutomationGeneratedWorkspace,
  isCliCreated: isCliCreatedWorkspace,
  isDetachedHead: isDetachedHeadWorkspace,
  isMainWorktree: (w) => w.isMainWorktree,
  isSleeping: (w) => w.sleeping,
  taskSession: (w) => w
})

/** The row the phone receives for this workspace from a current host. */
function served(w: Fixture): Worktree {
  return {
    workspaceKind: w.folderWorkspace ? 'folder-workspace' : 'git',
    worktreeId: w.id,
    repoId: w.repoId,
    hostId: 'local',
    repo: repoMap.get(w.repoId)?.displayName ?? w.repoId,
    branch: w.branch,
    displayName: w.displayName,
    path: w.path,
    isArchived: w.isArchived,
    isMainWorktree: w.isMainWorktree,
    hasHostSidebarActivity: !w.sleeping,
    ...(w.otherClient ? { desktopOtherClient: true } : {}),
    ...getWorkspaceRowKindFacts(w, repoMap.get(w.repoId)),
    buildWebTask: w.buildWebTask,
    buildWebSession: w.buildWebSession,
    liveTerminalCount: 0,
    hasAttachedPty: false,
    unread: false,
    isPinned: false,
    linkedPR: null
  }
}

const EVERY_SESSION_FILTER = HIDEABLE_TASK_SESSION_GROUPS.reduce<HideableTaskSessionGroup[][]>(
  (subsets, group) => subsets.concat(subsets.map((subset) => [...subset, group])),
  [[]]
)

function* everyFilterCombination(): Generator<Omit<WorkspaceRowFilters, 'visibleHostIds'>> {
  const bools = [false, true]
  for (const hideSleepingWorkspaces of bools) {
    for (const alwaysShowDefaultBranchWorkspace of [undefined, true, false]) {
      for (const hideDefaultBranchWorkspace of bools) {
        for (const hideAutomationGeneratedWorkspaces of bools) {
          for (const hideCliCreatedWorkspaces of bools) {
            for (const hideDetachedHeadWorkspaces of bools) {
              for (const hideWorkspacesFromOtherDevices of bools) {
                for (const filterRepoIds of [[], ['git'], ['folder-repo']]) {
                  for (const hiddenSessionStates of EVERY_SESSION_FILTER) {
                    yield {
                      hideSleepingWorkspaces,
                      alwaysShowDefaultBranchWorkspace,
                      hideDefaultBranchWorkspace,
                      hideAutomationGeneratedWorkspaces,
                      hideCliCreatedWorkspaces,
                      hideDetachedHeadWorkspaces,
                      hideWorkspacesFromOtherDevices,
                      filterRepoIds,
                      hiddenSessionStates
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}

describe('the phone shows what the desktop sidebar shows', () => {
  it.each([false, true])(
    'under every Workspace options filter combination, folder projects and tasks included (By task: %s)',
    (byTask) => {
      const phoneRows = FIXTURES.map(served)
      let combinations = 0
      for (const filters of everyFilterCombination()) {
        combinations += 1
        const desktop = filterWorkspaceRows(
          FIXTURES,
          { ...filters, visibleHostIds: null },
          desktopFacts(byTask)
        )
        const phone = filterWorktrees(
          phoneRows,
          { ...filters, visibleHostIds: null },
          '',
          new Map(),
          {
            hostKnowsTasks: true,
            keepArchivedAttention: byTask
          }
        )
        expect(
          phone.map((w) => w.worktreeId),
          JSON.stringify(filters)
        ).toEqual(desktop.map((w) => w.id))
      }
      expect(combinations).toBe(2 * 3 * 2 ** 5 * 3 * 2 ** 3)
    }
  )

  it('keeps every row an older host sends, whatever kind filter is on', () => {
    const legacy: Worktree[] = FIXTURES.filter((w) => !w.isArchived && !w.otherClient).map((w) => ({
      worktreeId: w.id,
      repoId: w.repoId,
      repo: w.repoId,
      branch: w.branch,
      displayName: w.displayName,
      path: w.path,
      liveTerminalCount: 1,
      hasAttachedPty: false,
      unread: false,
      isPinned: false,
      linkedPR: null
    }))
    const kindFiltersOn = {
      hideSleepingWorkspaces: false,
      hideDefaultBranchWorkspace: false,
      hideAutomationGeneratedWorkspaces: true,
      hideCliCreatedWorkspaces: true,
      hideDetachedHeadWorkspaces: true,
      hideWorkspacesFromOtherDevices: true,
      filterRepoIds: [],
      visibleHostIds: null,
      // A host that predates task sessions reports no task, which must not read as «no task».
      hiddenSessionStates: [...HIDEABLE_TASK_SESSION_GROUPS]
    }
    expect(filterWorktrees(legacy, kindFiltersOn, '')).toHaveLength(legacy.length)
  })
})
