import { join } from 'node:path'
import type { WorktreeMeta } from '../../shared/worktree/meta-types'
import { getProfileUserDataPath } from '../orca-profiles/profile-storage-paths'
import { setWorktreeMetaRowRemovedListener } from '../persistence/host-qualified-worktree-meta'
import { keepBuildWebAgentSession, reportBuildWebWorktreeRemoved } from './build-web-agent-sessions'
import { getStoredBuildWebMetadata, hasStoredBuildWebCredential } from './credential-store'
import {
  createBuildWebSessionReportQueue,
  type BuildWebSessionReport,
  type BuildWebSessionReportQueue
} from './build-web-session-report-queue'

// The host's one report queue (IS-147), in userData so desktop and `orca serve` both keep it.

const FILE_NAME = 'build-web-session-reports.json'

let queue: BuildWebSessionReportQueue | null = null

function sendReport(report: BuildWebSessionReport): Promise<unknown> {
  return report.kind === 'keep'
    ? keepBuildWebAgentSession(report.sessionId, { background: true })
    : reportBuildWebWorktreeRemoved(
        report.sessionId,
        { note: report.note, external: report.external },
        { background: true }
      )
}

export function buildWebSessionReports(): BuildWebSessionReportQueue {
  queue ??= createBuildWebSessionReportQueue({
    filePath: join(getProfileUserDataPath(), FILE_NAME),
    consoleHost: () =>
      hasStoredBuildWebCredential() ? (getStoredBuildWebMetadata()?.baseUrl ?? null) : null,
    send: sendReport
  })
  return queue
}

/** A removed task worktree's report, for every delete path that ends in removeWorktreeMetaRow. */
export function reportRemovedBuildWebWorktree(
  reports: Pick<BuildWebSessionReportQueue, 'enqueue'>,
  meta: Pick<WorktreeMeta, 'buildWebTask'>
): void {
  const task = meta.buildWebTask
  if (task?.sessionId) {
    reports.enqueue({
      kind: 'worktree-removed',
      sessionId: task.sessionId,
      consoleHost: task.consoleHost
    })
  }
}

export function installBuildWebSessionReports(): BuildWebSessionReportQueue {
  const reports = buildWebSessionReports()
  setWorktreeMetaRowRemovedListener((_worktreeId, meta) =>
    reportRemovedBuildWebWorktree(reports, meta)
  )
  return reports
}
