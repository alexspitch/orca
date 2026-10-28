import { useState } from 'react'
import type { BuildWebIssueRow } from '../../../../shared/build-web-types'
import { openNamedTaskSession } from './build-web-task-session'
import { openTaskSessionWorktree } from './build-web-session-worktree'
import { useBuildWebStore } from './build-web-store'

/** The task's open session when this client has it, so taking it again does not start another. */
function openHeldSession(picked: BuildWebIssueRow[]): boolean {
  const [issue] = picked
  if (picked.length !== 1 || !issue) {
    return false
  }
  // Why by name for `cp`: its sessions keep their monorepo worktree, which no task link names.
  if (issue.product === 'cp') {
    return openNamedTaskSession(picked)
  }
  const consoleHost = useBuildWebStore.getState().status?.baseUrl
  return consoleHost ? openTaskSessionWorktree(issue, consoleHost) : false
}

/** «Take to work»: the task's current open session when one is here, else the dialog that starts one. */
export function useTakeToWork(): {
  taking: BuildWebIssueRow[] | null
  takeToWork: (picked: BuildWebIssueRow[]) => void
  closeTaking: () => void
} {
  const [taking, setTaking] = useState<BuildWebIssueRow[] | null>(null)
  const takeToWork = (picked: BuildWebIssueRow[]): void => {
    if (!openHeldSession(picked)) {
      setTaking(picked)
    }
  }
  return { taking, takeToWork, closeTaking: () => setTaking(null) }
}
