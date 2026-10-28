import { useState } from 'react'
import type { BuildWebConsoleTask } from '../../../../src/shared/build-web-activity-types'
import type { BuildWebRun } from '../../../../src/shared/build-web-run-types'
import { buildWebErrorMessage } from '../build-web-operations'
import { useBuildWebScreen } from '../build-web-screen-context'

// The build statuses a run's failure is about, as the desktop's open-activity-target reads them.
const FAILED_BUILD = new Set(['FAILURE', 'UNSTABLE', 'trigger-failed', 'poll-failed'])

/** The image a run is about: its failed build's, else its first. */
const imageOf = (run: BuildWebRun): string | null =>
  (run.builds.find((b) => FAILED_BUILD.has(b.status)) ?? run.builds[0])?.image ?? null

/**
 * Where a task opens on the phone, after the desktop's task menu: a run on its task's card, else
 * on its image; a console job as its log over the list; a redos build's page as a build log.
 */
export function useOpenTask({
  onOpenIssue,
  onOpenImage
}: {
  onOpenIssue: (issueId: string) => void
  onOpenImage: (image: string) => void
}) {
  const { call, notify } = useBuildWebScreen()
  const [job, setJob] = useState<BuildWebConsoleTask | null>(null)
  const [log, setLog] = useState<{ url: string; title: string } | null>(null)

  const openRun = async (runId: string): Promise<void> => {
    const run = await call('getRun', { runId })
    if (!run) {
      return notify(`build-web has no build run ${runId}.`, 'error')
    }
    if (run.issue_id) {
      return onOpenIssue(run.issue_id)
    }
    // Why the number: a run made for a task by its number alone carries no task id.
    if (run.ticket) {
      const ticket = run.ticket
      const found = await call('listIssues', {
        view: 'all',
        q: ticket,
        limit: 20,
        offset: 0,
        tree: true
      })
      const issue = found.issues.find((row) => row.key === ticket || row.jira_key === ticket)
      if (issue) {
        return onOpenIssue(issue.id)
      }
    }
    const image = imageOf(run)
    if (image) {
      return onOpenImage(image)
    }
    notify(`The app could not place build run ${runId}.`, 'error')
  }

  return {
    job,
    log,
    closeJob: () => setJob(null),
    closeLog: () => setLog(null),
    buildPage: (task: BuildWebConsoleTask, url: string) => setLog({ url, title: task.title }),
    task: (task: BuildWebConsoleTask) => {
      if (task.source === 'build') {
        openRun(task.id).catch((failure: unknown) => notify(buildWebErrorMessage(failure), 'error'))
      } else if (task.source === 'test') {
        notify('Test runs open on the Testing page of the desktop app.', 'info')
      } else if (task.has_log) {
        setJob(task)
      }
    }
  }
}
