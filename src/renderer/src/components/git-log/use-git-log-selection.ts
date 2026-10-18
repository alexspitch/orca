import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '@/store'
import { useActiveWorktree, useRepos } from '@/store/selectors'
import { ipcOrRuntimeTargetForHostId } from '@/runtime/runtime-client-target'
import type { RuntimeGitContext } from '@/runtime/runtime-git-client-context'
import { getConnectionId } from '@/lib/connection-context'
import { getRepoExecutionHostId } from '../../../../shared/execution-host'
import type { Repo } from '../../../../shared/repo-types'
import type { Worktree } from '../../../../shared/worktree/types'
import { gitLogRepos, resolveGitLogSelection } from './resolve-git-log-selection'
import { readGitLogViewPrefs, writeGitLogViewPrefs } from './git-log-view-prefs'

const NO_WORKTREES: readonly Worktree[] = []

export type GitLogSelectionState = {
  repos: Repo[]
  repo: Repo | null
  worktrees: readonly Worktree[]
  worktree: Worktree | null
  /** How git reads reach the picked worktree; null when its host can't be addressed. */
  context: RuntimeGitContext | null
  pickRepo: (repoId: string) => void
  pickWorktree: (worktreeId: string) => void
}

type GitLogPick = { repoId: string | null; worktreeId: string | null }

// Why module state: a project or worktree picked in the header stays picked while Orca runs, so
// leaving the page and coming back shows it again; a fresh start opens on the default project.
let sessionPick: GitLogPick = { repoId: null, worktreeId: null }

export function useGitLogSelection(): GitLogSelectionState {
  const allRepos = useRepos()
  const worktreesByRepo = useAppStore((s) => s.worktreesByRepo)
  const defaultRepoId = useAppStore((s) => s.settings?.gitLogDefaultRepoId ?? null)
  const activeWorktree = useActiveWorktree()
  // Why read once: the page opens on the default project; later picks only feed the next opening.
  const [prefs] = useState(readGitLogViewPrefs)
  const [picked, setPickedState] = useState<GitLogPick>(sessionPick)
  const setPicked = (next: GitLogPick) => {
    sessionPick = next
    setPickedState(next)
  }

  const { repo, worktree } = useMemo(
    () =>
      resolveGitLogSelection({
        repos: allRepos,
        worktreesByRepo,
        defaultRepoId,
        activeWorktree,
        lastRepoId: prefs.lastRepoId,
        lastWorktreeByRepo: prefs.lastWorktreeByRepo,
        pickedRepoId: picked.repoId,
        pickedWorktreeId: picked.worktreeId
      }),
    [activeWorktree, allRepos, defaultRepoId, picked, prefs, worktreesByRepo]
  )

  const repoId = repo?.id ?? null
  const pickedWorktreeId = worktree?.id ?? null
  useEffect(() => {
    if (!repoId) {
      return
    }
    const last = readGitLogViewPrefs().lastWorktreeByRepo
    writeGitLogViewPrefs({
      lastRepoId: repoId,
      lastWorktreeByRepo: pickedWorktreeId ? { ...last, [repoId]: pickedWorktreeId } : last
    })
  }, [repoId, pickedWorktreeId])

  // Why primitive deps: store refreshes hand out new worktree objects; a new context would reload the log.
  const hostId = repo ? getRepoExecutionHostId(repo) : null
  const worktreeId = worktree?.id ?? null
  const worktreePath = worktree?.path ?? null
  const context = useMemo((): RuntimeGitContext | null => {
    if (!hostId || !worktreeId || !worktreePath) {
      return null
    }
    const target = ipcOrRuntimeTargetForHostId(hostId)
    if (!target) {
      return null
    }
    return {
      target,
      worktreeId,
      worktreePath,
      connectionId: getConnectionId(worktreeId) ?? undefined
    }
  }, [hostId, worktreeId, worktreePath])

  return {
    repos: useMemo(() => gitLogRepos(allRepos), [allRepos]),
    repo,
    worktrees: repo ? (worktreesByRepo[repo.id] ?? NO_WORKTREES) : NO_WORKTREES,
    worktree,
    context,
    pickRepo: (repoId) => setPicked({ repoId, worktreeId: null }),
    pickWorktree: (worktreeId) => setPicked({ repoId: repo?.id ?? picked.repoId, worktreeId })
  }
}
