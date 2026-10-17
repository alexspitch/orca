import { create } from 'zustand'
import type {
  BuildWebConnectionStatus,
  BuildWebIssueRow,
  BuildWebProduct,
  BuildWebStatus,
  BuildWebView
} from '../../../../shared/build-web-types'

/** The statuses a task is still being worked in — the list's default. */
export const OPEN_STATUSES: readonly BuildWebStatus[] = [
  'todo',
  'planned',
  'inprogress',
  'paused',
  'awaiting_response',
  'deploying',
  'build_failed',
  'testing',
  'testing_external'
]

export type BuildWebStatusFilter = 'open' | 'all' | BuildWebStatus

type BuildWebState = {
  /** Which host's answer `status` is: a reply from a host the page left is dropped. */
  contextKey: string | null
  status: BuildWebConnectionStatus | null
  view: BuildWebView
  query: string
  statusFilter: BuildWebStatusFilter
  product: BuildWebProduct | 'all'
  issues: BuildWebIssueRow[]
  total: number
  loading: boolean
  error: string | null
  selected: ReadonlySet<string>
  openIssueId: string | null
  fullScreen: boolean
  /** The worktree «Take to work» used last, and whether it worked in it (`-no-worktree`). */
  lastWorktreeId: string | null
  noWorktree: boolean
  setStatus: (contextKey: string, status: BuildWebConnectionStatus) => void
  setView: (view: BuildWebView) => void
  setQuery: (query: string) => void
  setStatusFilter: (filter: BuildWebStatusFilter) => void
  setProduct: (product: BuildWebProduct | 'all') => void
  setLoading: () => void
  setIssues: (issues: BuildWebIssueRow[], total: number) => void
  setError: (error: string) => void
  patchIssue: (id: string, patch: Partial<BuildWebIssueRow>) => void
  toggleSelected: (id: string) => void
  clearSelection: () => void
  openIssue: (id: string | null, fullScreen?: boolean) => void
  setFullScreen: (fullScreen: boolean) => void
  rememberTakeToWork: (worktreeId: string, noWorktree: boolean) => void
}

export const useBuildWebStore = create<BuildWebState>()((set) => ({
  contextKey: null,
  status: null,
  view: 'mine',
  query: '',
  statusFilter: 'open',
  product: 'all',
  issues: [],
  total: 0,
  loading: false,
  error: null,
  selected: new Set(),
  openIssueId: null,
  fullScreen: false,
  lastWorktreeId: null,
  noWorktree: true,
  setStatus: (contextKey, status) =>
    set((state) =>
      // Why: another host's tasks must not stay on screen under this host's account.
      state.contextKey === contextKey
        ? { status }
        : { contextKey, status, issues: [], total: 0, selected: new Set(), openIssueId: null }
    ),
  setView: (view) => set({ view }),
  setQuery: (query) => set({ query }),
  setStatusFilter: (statusFilter) => set({ statusFilter }),
  setProduct: (product) => set({ product }),
  setLoading: () => set({ loading: true }),
  setIssues: (issues, total) =>
    set((state) => {
      // Why: a selection must not hold tasks the list no longer shows — Take to work would send them.
      const shown = new Set(issues.map((issue) => issue.id))
      const selected = new Set([...state.selected].filter((id) => shown.has(id)))
      return { issues, total, loading: false, error: null, selected }
    }),
  setError: (error) => set({ loading: false, error }),
  patchIssue: (id, patch) =>
    set((state) => ({
      issues: state.issues.map((issue) => (issue.id === id ? { ...issue, ...patch } : issue))
    })),
  toggleSelected: (id) =>
    set((state) => {
      const selected = new Set(state.selected)
      if (!selected.delete(id)) {
        selected.add(id)
      }
      return { selected }
    }),
  clearSelection: () => set({ selected: new Set() }),
  openIssue: (openIssueId, fullScreen = false) => set({ openIssueId, fullScreen }),
  setFullScreen: (fullScreen) => set({ fullScreen }),
  rememberTakeToWork: (lastWorktreeId, noWorktree) => set({ lastWorktreeId, noWorktree })
}))

/** The list request for the current filters. */
export function issueQueryOf(
  state: Pick<BuildWebState, 'view' | 'query' | 'statusFilter' | 'product'>
) {
  return {
    view: state.view,
    q: state.query.trim() || undefined,
    status:
      state.statusFilter === 'all'
        ? undefined
        : state.statusFilter === 'open'
          ? [...OPEN_STATUSES]
          : [state.statusFilter],
    product: state.product === 'all' ? undefined : [state.product]
  }
}
