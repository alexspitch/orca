import {
  NO_WORKSPACE_ROW_FILTERS,
  filterWorkspaceRows,
  type WorkspaceRowFactReader
} from '../../../src/shared/workspace-view/workspace-row-filters'
import type { Repo } from '../../../src/shared/repo-types'
import type { WorktreeBuildWebSessionState } from '../../../src/shared/build-web-session-types'
import type { WorktreeLineage } from '../../../src/shared/worktree/lineage-types'
import type { Worktree as DesktopWorktree } from '../../../src/shared/worktree/types'
import { planSidebarRows } from '../../../src/shared/sidebar-list/sidebar-row-plan'
import { compareSidebarText } from '../../../src/shared/sidebar-list/text-order'
import {
  isTaskSessionAttention,
  type HideableTaskSessionGroup
} from '../../../src/shared/sidebar-list/task-session-groups'
import { DEFAULT_WORKSPACE_STATUSES } from '../../../src/shared/workspace-statuses'
import { describe, expect, it } from 'vitest'
import { getRepoExecutionHostId } from '../../../src/shared/execution-host'
import {
  PROJECT_SECTION_PARITY_HEADERS,
  PROJECT_SECTION_PARITY_ROWS,
  PROJECT_SECTION_PARITY_SERVED
} from '../../../src/shared/project-section-parity.test-fixture'
import { buildProjectSectionCatalog } from './project-section-catalog'
import {
  projectSectionsRead,
  readServedProjectSections,
  type ServedProjectSections
} from './project-sections-operations'
import {
  NO_PROJECT_SECTION_CATALOG,
  buildMobileWorkspacePlan,
  buildSections,
  collapseSections,
  type Worktree
} from './workspace-list-sections'

// Counterpart: renderer sidebar/worktree-list-groups-mobile-parity.test.ts uses the same served project fixtures.

function served(): ServedProjectSections | null {
  const verdict = projectSectionsRead.interpret({
    id: 'sections',
    ok: true,
    result: { catalog: PROJECT_SECTION_PARITY_SERVED }
  })
  return verdict.accepted ? verdict.value : null
}

function rows(): Worktree[] {
  const repoById = new Map(PROJECT_SECTION_PARITY_SERVED.repos.map((repo) => [repo.id, repo]))
  return PROJECT_SECTION_PARITY_ROWS.flatMap((row) => {
    const repo = repoById.get(row.repoId)
    return repo
      ? [
          {
            worktreeId: row.id,
            repoId: row.repoId,
            hostId: getRepoExecutionHostId(repo),
            repo: repo.displayName,
            branch: 'feature',
            displayName: row.id,
            path: `${repo.path}-${row.id}`,
            lastActivityAt: row.lastActivityAt,
            liveTerminalCount: 0,
            hasAttachedPty: false,
            unread: false,
            isPinned: false,
            linkedPR: null
          }
        ]
      : []
  })
}

function headers(catalog: ReturnType<typeof buildProjectSectionCatalog>) {
  return buildSections(
    rows(),
    'recent',
    { ...NO_WORKSPACE_ROW_FILTERS },
    '',
    'repo',
    new Set(),
    catalog
  ).map((section) => ({ key: section.key, label: section.title }))
}

describe('Project grouping on the phone', () => {
  it.each(['recent', 'manual'] as const)(
    "renders the desktop sidebar's %s headers from the catalog the desktop serves",
    (projectOrderBy) => {
      expect(rows()).toHaveLength(PROJECT_SECTION_PARITY_ROWS.length)
      expect(headers(buildProjectSectionCatalog(served(), [], null, projectOrderBy))).toEqual(
        PROJECT_SECTION_PARITY_HEADERS[projectOrderBy]
      )
    }
  )

  it("groups by repo from an older desktop's own repos when it serves no catalog", () => {
    const desktopRepos = PROJECT_SECTION_PARITY_SERVED.repos.filter(
      (repo) => repo.executionHostId === 'local'
    )

    expect(headers(buildProjectSectionCatalog(null, desktopRepos, null, 'manual'))).toEqual([
      { key: 'repo:m4-orca-two', label: 'orca' },
      { key: 'repo:win-orca', label: 'orca' },
      { key: 'repo:local-workspace', label: 'orca/orca' },
      { key: 'repo:local-stably', label: 'stably/orca' },
      { key: 'repo:m4-orca', label: 'orca' },
      { key: 'repo:local-assets', label: 'design-assets' }
    ])
  })

  it('drops a served setup whose host id this build cannot read, keeping the rest', () => {
    const verdict = projectSectionsRead.interpret({
      id: 'sections',
      ok: true,
      result: {
        catalog: {
          ...PROJECT_SECTION_PARITY_SERVED,
          setups: [
            { ...PROJECT_SECTION_PARITY_SERVED.setups[0], hostId: 'nonsense' },
            ...PROJECT_SECTION_PARITY_SERVED.setups.slice(1)
          ]
        }
      }
    })

    expect(verdict.accepted && verdict.value?.setups).toHaveLength(
      PROJECT_SECTION_PARITY_SERVED.setups.length - 1
    )
  })
})

describe('readServedProjectSections', () => {
  it('reads a served catalog, and a desktop with no published window as none', () => {
    expect(
      readServedProjectSections({
        id: 'sections',
        ok: true,
        result: { catalog: PROJECT_SECTION_PARITY_SERVED }
      })
    ).toMatchObject({ kind: 'answered', value: { repos: expect.any(Array) } })
    expect(
      readServedProjectSections({ id: 'sections', ok: true, result: { catalog: null } })
    ).toEqual({ kind: 'answered', value: null })
  })

  it.each(['forbidden', 'method_not_found'])(
    'reads an older desktop that answers %s as serving none',
    (code) => {
      expect(
        readServedProjectSections({ id: 'sections', ok: false, error: { code, message: code } })
      ).toEqual({ kind: 'answered', value: null })
    }
  )

  it('keeps the last catalog after a timeout or a dropped reply', () => {
    expect(
      readServedProjectSections({
        id: 'sections',
        ok: false,
        error: { code: 'timeout', message: 'timed out' }
      })
    ).toEqual({ kind: 'kept' })
    expect(readServedProjectSections(null)).toEqual({ kind: 'kept' })
  })
})

// IS-147: the cast of the desktop golden group-by-task.txt; feat-a's lineage spreads over three lanes.
// The `input` rows have an agent waiting on the user: one with no task, one pinned, one in attention.
type TaskSpec = {
  name: string
  task?: string
  state?: WorktreeBuildWebSessionState
  pinned?: true
  archived?: true
  parent?: string
  main?: true
  input?: true
}

const TASK_SPECS: TaskSpec[] = [
  { name: 'orca', main: true },
  { name: 'feat-a', task: 'IS-1', state: 'active', pinned: true },
  { name: 'feat-b', task: 'IS-2', state: 'waiting', parent: 'feat-a' },
  { name: 'feat-c', task: 'IS-3', state: 'attention', pinned: true, input: true },
  { name: 'gitlab-mr', task: 'IS-6', state: 'active', parent: 'feat-a' },
  { name: 'api-y', task: 'IS-5', state: 'closing' },
  // A task whose state the host has not reported yet reads as in progress.
  { name: 'same', task: 'IS-7' },
  { name: 'zeta' },
  { name: 'archived', task: 'IS-4', state: 'attention', archived: true },
  { name: 'old', archived: true },
  { name: 'ask', input: true },
  { name: 'ask-pin', task: 'IS-8', state: 'waiting', pinned: true, input: true }
]
const AWAITING_INPUT = new Set(
  TASK_SPECS.filter((spec) => spec.input).map((spec) => `orca::/w/${spec.name}`)
)

const ORCA_REPO: Repo = {
  id: 'orca',
  path: '/orca',
  displayName: 'orca',
  badgeColor: '#000',
  addedAt: 0
}
const taskRowId = (name: string) => `orca::/w/${name}`

function desktopTaskRow(spec: TaskSpec): DesktopWorktree {
  return {
    id: taskRowId(spec.name),
    instanceId: `i-${spec.name}`,
    repoId: 'orca',
    path: `/w/${spec.name}`,
    head: 'abc1234',
    branch: `refs/heads/${spec.name}`,
    isBare: false,
    isMainWorktree: spec.main === true,
    displayName: spec.name,
    comment: '',
    linkedIssue: null,
    linkedPR: null,
    linkedLinearIssue: null,
    isArchived: spec.archived === true,
    isUnread: false,
    isPinned: spec.pinned === true,
    sortOrder: 0,
    lastActivityAt: 0,
    ...(spec.task
      ? {
          buildWebTask: {
            issueId: spec.task,
            key: spec.task,
            consoleHost: 'https://console',
            branch: spec.name
          }
        }
      : {}),
    ...(spec.state ? { buildWebSession: { state: spec.state, at: 0 } } : {})
  }
}

/** What worktree.ps serves the phone for the same workspace. */
function phoneTaskRow(spec: TaskSpec): Worktree {
  const row = desktopTaskRow(spec)
  return {
    worktreeId: row.id,
    repoId: row.repoId,
    repo: 'orca',
    branch: row.branch,
    displayName: row.displayName,
    path: row.path,
    isArchived: row.isArchived,
    isMainWorktree: row.isMainWorktree,
    hasHostSidebarActivity: true,
    worktreeInstanceId: row.instanceId,
    ...(spec.parent
      ? {
          parentWorktreeId: taskRowId(spec.parent),
          lineageWorktreeInstanceId: row.instanceId,
          parentWorktreeInstanceId: `i-${spec.parent}`
        }
      : {}),
    buildWebTask: row.buildWebTask,
    buildWebSession: row.buildWebSession,
    ...(spec.input ? { status: 'permission' as const } : {}),
    liveTerminalCount: 0,
    hasAttachedPty: false,
    unread: false,
    isPinned: row.isPinned,
    linkedPR: null
  }
}

const TASK_LINEAGE: Record<string, WorktreeLineage> = Object.fromEntries(
  TASK_SPECS.flatMap((spec) =>
    spec.parent
      ? [
          [
            taskRowId(spec.name),
            {
              worktreeId: taskRowId(spec.name),
              worktreeInstanceId: `i-${spec.name}`,
              parentWorktreeId: taskRowId(spec.parent),
              parentWorktreeInstanceId: `i-${spec.parent}`,
              origin: 'manual',
              capture: { source: 'manual-action', confidence: 'explicit' },
              createdAt: 0
            } satisfies WorktreeLineage
          ]
        ]
      : []
  )
)

type TaskView = {
  groupBy: 'task' | 'none'
  pinnedInGroups: boolean
  collapsed: string[]
  hidden: HideableTaskSessionGroup[]
  /** The Input required switch; off unless set. */
  inputGroup?: true
}

type DrawnSection = { key: string; count: number; rows: [string, number][] }

/** The desktop sidebar: its row filter (desktop-workspace-row-facts.ts), name sort, then its planner. */
function desktopTaskSections(view: TaskView): DrawnSection[] {
  const keepArchivedTaskAttention = view.groupBy === 'task'
  // The window's reader: its status lane's «needs input», while «By task» shows the group.
  const inputRequiredOf =
    view.groupBy === 'task' && view.inputGroup
      ? (w: Pick<DesktopWorktree, 'id'>) => AWAITING_INPUT.has(w.id)
      : undefined
  const facts: WorkspaceRowFactReader<DesktopWorktree> = {
    isArchived: (w) => w.isArchived && !(keepArchivedTaskAttention && isTaskSessionAttention(w)),
    isFolderWorkspace: () => false,
    repoId: (w) => w.repoId,
    hostId: () => 'local',
    isOtherClient: () => false,
    isDefaultBranch: () => false,
    isAutomationCreated: () => false,
    isCliCreated: () => false,
    isDetachedHead: () => false,
    isMainWorktree: (w) => w.isMainWorktree,
    isSleeping: () => false,
    taskSession: (w) => w,
    isInputRequired: (w) => inputRequiredOf?.(w) === true
  }
  const all = TASK_SPECS.map(desktopTaskRow)
  const visible = filterWorkspaceRows(
    all,
    { ...NO_WORKSPACE_ROW_FILTERS, hiddenSessionStates: view.hidden },
    facts
  ).sort((a, b) => compareSidebarText(a.displayName, b.displayName))
  const plan = planSidebarRows({
    groupBy: view.groupBy,
    worktrees: visible,
    repoMap: new Map([[ORCA_REPO.id, ORCA_REPO]]),
    prGroupOf: () => 'in-progress',
    inputRequiredOf,
    workspaceStatuses: DEFAULT_WORKSPACE_STATUSES,
    projectOrderBy: 'manual',
    lineageById: TASK_LINEAGE,
    worktreeMap: new Map(all.map((w) => [w.id, w])),
    nestLineage: true,
    projectGroups: [],
    placeholderRepoIds: new Set(),
    importedWorktreesByRepo: new Map(),
    newExternalWorktreesInboxByRepo: new Map(),
    pendingCreations: [],
    folderWorkspaces: [],
    defaultHostId: 'local',
    pinnedDisplayPolicy: view.pinnedInGroups ? 'duplicate-in-groups' : 'single-location',
    filterRepoIds: []
  })
  const sections: DrawnSection[] = []
  for (const row of plan.render(new Set(view.collapsed))) {
    if (row.type === 'header') {
      sections.push({ key: row.key, count: row.count, rows: [] })
    } else if (row.type === 'item') {
      sections.at(-1)?.rows.push([row.worktree.id, row.depth])
    }
  }
  return sections
}

function phoneTaskSections(view: TaskView): DrawnSection[] {
  const plan = buildMobileWorkspacePlan(
    TASK_SPECS.map(phoneTaskRow),
    'name',
    { ...NO_WORKSPACE_ROW_FILTERS, hiddenSessionStates: view.hidden },
    '',
    view.groupBy,
    new Set(),
    NO_PROJECT_SECTION_CATALOG,
    DEFAULT_WORKSPACE_STATUSES,
    undefined,
    view.pinnedInGroups,
    new Map(),
    true,
    undefined,
    view.inputGroup === true
  )
  const raw = plan.render(new Set())
  return collapseSections(raw, new Set(view.collapsed)).map((section, index) => ({
    key: section.key,
    count: raw[index]?.data.length ?? 0,
    rows: section.data.map((row): [string, number] => [row.worktreeId, row.lineageDepth ?? 0])
  }))
}

describe('«By task» on the phone', () => {
  const views: [string, TaskView][] = [
    ['plain', { groupBy: 'task', pinnedInGroups: false, collapsed: [], hidden: [] }],
    ['pinned in groups', { groupBy: 'task', pinnedInGroups: true, collapsed: [], hidden: [] }],
    [
      'release opened',
      { groupBy: 'task', pinnedInGroups: false, collapsed: ['task:release:expanded'], hidden: [] }
    ],
    [
      'in progress collapsed by hand',
      { groupBy: 'task', pinnedInGroups: true, collapsed: ['task:progress'], hidden: [] }
    ],
    [
      'session filter hides every lane it may',
      {
        groupBy: 'task',
        pinnedInGroups: false,
        collapsed: [],
        hidden: ['none', 'progress', 'release']
      }
    ],
    ['another grouping', { groupBy: 'none', pinnedInGroups: false, collapsed: [], hidden: [] }],
    [
      'input required',
      { groupBy: 'task', pinnedInGroups: false, collapsed: [], hidden: [], inputGroup: true }
    ],
    [
      'input required, pinned in groups, session filter hides every lane it may',
      {
        groupBy: 'task',
        pinnedInGroups: true,
        collapsed: [],
        hidden: ['none', 'progress', 'release'],
        inputGroup: true
      }
    ],
    [
      'input required collapsed by hand',
      {
        groupBy: 'task',
        pinnedInGroups: false,
        collapsed: ['task:input'],
        hidden: [],
        inputGroup: true
      }
    ],
    [
      'input required in another grouping',
      { groupBy: 'none', pinnedInGroups: false, collapsed: [], hidden: [], inputGroup: true }
    ]
  ]
  const viewNamed = (label: string): TaskView => {
    const found = views.find(([name]) => name === label)
    if (!found) {
      throw new Error(label)
    }
    return found[1]
  }
  const rowIdsOf = (sections: DrawnSection[], key: string) =>
    sections.find((section) => section.key === key)?.rows.map(([id]) => id) ?? []

  it.each(views)("renders the desktop sidebar's lanes and rows (%s)", (_label, view) => {
    expect(phoneTaskSections(view)).toEqual(desktopTaskSections(view))
  })

  it('puts attention first, keeps a pinned attention row out of Pinned and opens release on demand', () => {
    const plain = phoneTaskSections(views[0][1])
    expect(plain.map((section) => section.key)).toEqual([
      'task:attention',
      'pinned',
      'task:release',
      'task:progress',
      'task:none'
    ])
    expect(plain[0]?.rows.map(([id]) => id)).toEqual([taskRowId('archived'), taskRowId('feat-c')])
    expect(plain[2]).toMatchObject({ count: 1, rows: [] })
    const outside = phoneTaskSections(views[5][1]).flatMap((section) => section.rows)
    expect(outside.map(([id]) => id)).not.toContain(taskRowId('archived'))
  })

  it('lists a waiting agent after attention and before Pinned, past the session filter', () => {
    const on = phoneTaskSections(viewNamed('input required'))
    expect(on.map((section) => section.key)).toEqual([
      'task:attention',
      'task:input',
      'pinned',
      'task:release',
      'task:progress',
      'task:none'
    ])
    // A closed task's leftover stays in Needs attention though its agent waits too.
    expect(rowIdsOf(on, 'task:attention')).toEqual([taskRowId('archived'), taskRowId('feat-c')])
    expect(rowIdsOf(on, 'task:input')).toEqual([taskRowId('ask'), taskRowId('ask-pin')])
    expect(rowIdsOf(on, 'pinned')).not.toContain(taskRowId('ask-pin'))
    const filtered = phoneTaskSections({ ...viewNamed('input required'), hidden: ['none'] })
    expect(rowIdsOf(filtered, 'task:input')).toEqual([taskRowId('ask'), taskRowId('ask-pin')])
  })

  it('returns waiting rows to their task lanes while the switch is off', () => {
    const off = phoneTaskSections(viewNamed('plain'))
    expect(off.map((section) => section.key)).not.toContain('task:input')
    expect(rowIdsOf(off, 'pinned')).toContain(taskRowId('ask-pin'))
    expect(rowIdsOf(off, 'task:none')).toContain(taskRowId('ask'))
    const filtered = phoneTaskSections({ ...viewNamed('plain'), hidden: ['none'] })
    expect(filtered.flatMap((section) => section.rows.map(([id]) => id))).not.toContain(
      taskRowId('ask')
    )
  })
})
