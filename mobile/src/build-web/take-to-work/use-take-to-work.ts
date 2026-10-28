import { useCallback } from 'react'
import type { BuildWebIssueRow } from '../../../../src/shared/build-web-types'
import { currentOpenSession } from '../../../../src/shared/build-web-task-session-worktree'
import { useBuildWebScreen } from '../build-web-screen-context'
import { useOpenBuildWebSession } from '../list/use-open-build-web-session'

/** «Take to work»: the worktree holding the task's open session when the host has it, else the sheet. */
export function useTakeToWork(): (issues: BuildWebIssueRow[]) => void {
  const { takeToWork } = useBuildWebScreen()
  const { openTaskWorktree } = useOpenBuildWebSession()
  return useCallback(
    (issues: BuildWebIssueRow[]) => {
      const [issue] = issues
      // Why not for `cp`: its sessions run in a monorepo worktree no task link names.
      if (issues.length !== 1 || !issue || issue.product === 'cp' || !currentOpenSession(issue)) {
        takeToWork(issues)
        return
      }
      void openTaskWorktree(issue).then((opened) => {
        if (!opened) {
          takeToWork(issues)
        }
      })
    },
    [openTaskWorktree, takeToWork]
  )
}
