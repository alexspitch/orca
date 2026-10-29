import { lstatSync } from 'node:fs'
import { join } from 'node:path'
import type { WorktreeMeta } from '../../shared/worktree/meta-types'
import { splitWorktreeId } from '../../shared/worktree/id'
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

/** Synchronous: the report is enqueued inside the removal. Unreadable is not missing. */
function worktreeFolderExists(worktreeId: string): boolean {
  const path = splitWorktreeId(worktreeId)?.worktreePath
  if (!path) {
    return false
  }
  try {
    lstatSync(path)
    return true
  } catch (error) {
    const code = error instanceof Error && 'code' in error ? error.code : undefined
    return code !== 'ENOENT' && code !== 'ENOTDIR'
  }
}

/**
 * A dropped task worktree's report, for every path that ends in removeWorktreeMetaRow. Deletes
 * remove the folder before the row; Forget and an untracked project's cleanup leave it, which is a Keep.
 */
export function reportRemovedBuildWebWorktree(
  reports: Pick<BuildWebSessionReportQueue, 'enqueue'>,
  worktreeId: string,
  meta: Pick<WorktreeMeta, 'buildWebTask'>,
  folderExists: (worktreeId: string) => boolean = worktreeFolderExists
): void {
  const task = meta.buildWebTask
  if (task?.sessionId) {
    reports.enqueue({
      kind: folderExists(worktreeId) ? 'keep' : 'worktree-removed',
      sessionId: task.sessionId,
      consoleHost: task.consoleHost
    })
  }
}

export function installBuildWebSessionReports(): BuildWebSessionReportQueue {
  const reports = buildWebSessionReports()
  setWorktreeMetaRowRemovedListener((worktreeId, meta) =>
    reportRemovedBuildWebWorktree(reports, worktreeId, meta)
  )
  return reports
}
