// Per-viewer conveniences kept in localStorage (as build-web's view prefs are): the last project
// and worktree picked on the Git page, what was selected in each project, and the pane sizes.
// Lost storage just means defaults.

export const GIT_LOG_BRANCHES_MIN_WIDTH = 160
export const GIT_LOG_DETAILS_MIN_WIDTH = 300
export const GIT_LOG_SPLIT_MIN = 0.2
export const GIT_LOG_SPLIT_MAX = 0.8

export type GitLogFavorites = { added: string[]; removed: string[] }

/** What a project's Git page showed last: the Branch filter, the commit and its file. */
export type GitLogRepoView = {
  branch: string | null
  commitId: string | null
  filePath: string | null
}

export type GitLogViewPrefs = {
  lastRepoId: string | null
  /** The worktree last picked per project, by repo id. */
  lastWorktreeByRepo: Record<string, string>
  /** By repo id. */
  viewByRepo: Record<string, GitLogRepoView>
  /** Stars set or cleared by hand, by repo id, as full ref names (main/master start starred). */
  favoritesByRepo: Record<string, GitLogFavorites>
  branchesWidth: number
  branchesHidden: boolean
  detailsWidth: number
  /** Share of the details column the changed-files tree takes. */
  filesShare: number
}

const STORAGE_KEY = 'orca.gitLog.viewPrefs'
// Why a cap: one entry per project ever opened would grow without end.
const WORKTREES_KEPT = 50
const DEFAULTS: GitLogViewPrefs = {
  lastRepoId: null,
  lastWorktreeByRepo: {},
  viewByRepo: {},
  favoritesByRepo: {},
  branchesWidth: 240,
  branchesHidden: false,
  detailsWidth: 520,
  filesShare: 0.55
}

function numberOr(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback
}

const stringOrNull = (value: unknown): string | null => (typeof value === 'string' ? value : null)

function viewByRepoOf(raw: unknown): Record<string, GitLogRepoView> {
  const out: Record<string, GitLogRepoView> = {}
  if (!raw || typeof raw !== 'object') {
    return out
  }
  for (const [repoId, value] of Object.entries(raw).slice(-WORKTREES_KEPT)) {
    const view = value && typeof value === 'object' ? Object.fromEntries(Object.entries(value)) : {}
    out[repoId] = {
      branch: stringOrNull(view.branch),
      commitId: stringOrNull(view.commitId),
      filePath: stringOrNull(view.filePath)
    }
  }
  return out
}

const stringsOf = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((each): each is string => typeof each === 'string') : []

function favoritesByRepoOf(raw: unknown): Record<string, GitLogFavorites> {
  const out: Record<string, GitLogFavorites> = {}
  if (!raw || typeof raw !== 'object') {
    return out
  }
  for (const [repoId, value] of Object.entries(raw).slice(-WORKTREES_KEPT)) {
    const favorites =
      value && typeof value === 'object' ? Object.fromEntries(Object.entries(value)) : {}
    out[repoId] = { added: stringsOf(favorites.added), removed: stringsOf(favorites.removed) }
  }
  return out
}

function prefsOf(raw: unknown): GitLogViewPrefs {
  if (!raw || typeof raw !== 'object') {
    return DEFAULTS
  }
  const v = Object.fromEntries(Object.entries(raw))
  const lastWorktreeByRepo: Record<string, string> = {}
  if (v.lastWorktreeByRepo && typeof v.lastWorktreeByRepo === 'object') {
    for (const [repoId, worktreeId] of Object.entries(v.lastWorktreeByRepo).slice(
      -WORKTREES_KEPT
    )) {
      if (typeof worktreeId === 'string') {
        lastWorktreeByRepo[repoId] = worktreeId
      }
    }
  }
  return {
    lastRepoId: typeof v.lastRepoId === 'string' ? v.lastRepoId : null,
    lastWorktreeByRepo,
    viewByRepo: viewByRepoOf(v.viewByRepo),
    favoritesByRepo: favoritesByRepoOf(v.favoritesByRepo),
    branchesWidth: numberOr(
      v.branchesWidth,
      DEFAULTS.branchesWidth,
      GIT_LOG_BRANCHES_MIN_WIDTH,
      800
    ),
    branchesHidden: v.branchesHidden === true,
    detailsWidth: numberOr(v.detailsWidth, DEFAULTS.detailsWidth, GIT_LOG_DETAILS_MIN_WIDTH, 1600),
    filesShare: numberOr(v.filesShare, DEFAULTS.filesShare, GIT_LOG_SPLIT_MIN, GIT_LOG_SPLIT_MAX)
  }
}

export function readGitLogViewPrefs(): GitLogViewPrefs {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? prefsOf(JSON.parse(raw)) : DEFAULTS
  } catch {
    return DEFAULTS
  }
}

export function writeGitLogRepoView(repoId: string, view: GitLogRepoView): void {
  const { viewByRepo } = readGitLogViewPrefs()
  // Re-inserted last so the cap drops the projects visited longest ago.
  const others = Object.fromEntries(Object.entries(viewByRepo).filter(([id]) => id !== repoId))
  writeGitLogViewPrefs({ viewByRepo: { ...others, [repoId]: view } })
}

export function writeGitLogFavorites(repoId: string, favorites: GitLogFavorites): void {
  const { favoritesByRepo } = readGitLogViewPrefs()
  const others = Object.fromEntries(Object.entries(favoritesByRepo).filter(([id]) => id !== repoId))
  writeGitLogViewPrefs({ favoritesByRepo: { ...others, [repoId]: favorites } })
}

export function writeGitLogViewPrefs(patch: Partial<GitLogViewPrefs>): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readGitLogViewPrefs(), ...patch }))
  } catch {
    // Storage may be disabled; the preference just won't survive this session.
  }
}
