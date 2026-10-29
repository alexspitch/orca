import type {
  BuildWebSessionAttentionReason,
  WorktreeBuildWebSessionState
} from '../../../../shared/build-web-session-types'
import type { Worktree } from '../../../../shared/worktree/types'
import { useAppStore } from '@/store'
import type { AppState } from '@/store/types'
import { mainWt, repo, wt } from './sidebar-list-golden-factories.test-fixture'

// IS-147: the workspaces of the sidebar mockup (mossy-leaping-hinton-workspaces-mockup.html).

const NOW = Date.UTC(2026, 9, 28, 12, 0, 0)
const minutesAgo = (minutes: number): number => NOW - minutes * 60_000

const sa = repo('sa', 'sa-dc-ap-products', { repoIcon: { type: 'emoji', emoji: '🎙️' } })
const orca = repo('orca', 'orca', { repoIcon: { type: 'emoji', emoji: '🐋' } })
const cards = repo('cards', 'lang-cards', { repoIcon: { type: 'emoji', emoji: '📚' } })

function task(
  key: string,
  title: string,
  minutes: number,
  state?: WorktreeBuildWebSessionState,
  extra: Partial<Worktree> & { reason?: BuildWebSessionAttentionReason } = {}
): Worktree {
  const { reason, ...overrides } = extra
  const slug = key.toLowerCase()
  return wt(sa, slug, {
    displayName: title,
    lastActivityAt: minutesAgo(minutes),
    buildWebTask: { issueId: slug, key, consoleHost: 'https://console.dev', branch: slug },
    ...(state ? { buildWebSession: { state, ...(reason ? { reason } : {}), at: NOW } } : {}),
    ...overrides
  })
}

export const TASK_SESSION_WORKTREES: Worktree[] = [
  task('IS-158', 'Hotfix: export times out on large calls', 190, 'attention', {
    reason: 'commits',
    linkedPR: 471
  }),
  task('IS-133', 'Speaker labels in export', 25, 'attention', {
    reason: 'remove-failed',
    isArchived: true,
    removalError: 'Directory is busy'
  }),
  task('IS-149', 'Retry failed ASR jobs', 2, 'attention', { reason: 'agent-running' }),
  task('IS-164', 'Fix diarization drift on long calls', 2, 'active', {
    isUnread: true,
    linkedPR: 482
  }),
  task('IS-169', 'Redact PII in transcripts', 9, 'active'),
  wt(cards, 'deutch', { lastActivityAt: minutesAgo(14) }),
  task('IS-171', 'Health check for media workers', 1, 'active', { isPinned: true }),
  mainWt(orca, { displayName: 'orca', isPinned: true, lastActivityAt: minutesAgo(3) }),
  task('IS-166', 'Speed up transcript search index', 1, 'active', { linkedPR: 484 }),
  task('IS-172', 'Add CSV export for keyword hits', 3, 'active'),
  task('IS-175', 'German number normalization', 31, 'active'),
  task('IS-141', 'Evaluation export v1', 400),
  task('IS-152', 'Agent dashboard: empty state', 70, 'closing'),
  task('IS-150', 'Batch import from SFTP', 4, 'closing'),
  task('IS-155', 'Language model hot-swap', 60, 'waiting'),
  task('IS-159', 'Dark mode for player', 300, 'waiting'),
  wt(orca, 'invest', { lastActivityAt: minutesAgo(4) }),
  wt(orca, 'scratch', { lastActivityAt: minutesAgo(7000) })
]

const SELECTED = TASK_SESSION_WORKTREES.find((worktree) => worktree.buildWebTask?.key === 'IS-166')

/** Card density over the explorer's seeded settings, as a fixture's `setup`. */
export function withCompactCards(compactWorktreeCards: boolean): () => void {
  return () =>
    useAppStore.setState((state) => ({
      settings: state.settings ? { ...state.settings, compactWorktreeCards } : state.settings
    }))
}

/** The sidebar's store for these rows; the current row is IS-166. */
export function taskSessionStore(overrides: Partial<AppState> = {}): Partial<AppState> {
  const worktreesByRepo: AppState['worktreesByRepo'] = { sa: [], orca: [], cards: [] }
  for (const worktree of TASK_SESSION_WORKTREES) {
    worktreesByRepo[worktree.repoId]?.push(worktree)
  }
  return {
    repos: [sa, orca, cards],
    worktreesByRepo,
    groupBy: 'task',
    sortBy: 'recent',
    projectOrderBy: 'manual',
    showSleepingWorkspaces: true,
    collapsedGroups: new Set(),
    activeWorktreeId: SELECTED?.id ?? null,
    ...overrides
  }
}
