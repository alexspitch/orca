import type { Store } from '../persistence'
import type { OrcaRuntimeService } from '../runtime/orca-runtime'
import { installBuildWebSessionReports } from './build-web-session-reports'
import { BuildWebSessionWatcher } from './build-web-session-watcher'

// IS-147: the task-session watcher and its report queue, started by the desktop app and by orcad.

const POLL_MS = 60_000
const STUCK_MS = 24 * 60 * 60_000

/** E2E shortens the poll and the «stuck for a day» threshold through the environment. */
function envMs(name: string, fallback: number): number {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value > 0 ? value : fallback
}

export function startBuildWebSessionService(
  store: Store,
  runtime: OrcaRuntimeService
): BuildWebSessionWatcher | null {
  try {
    const watcher = new BuildWebSessionWatcher({
      runtime,
      store,
      reports: installBuildWebSessionReports(),
      pollMs: envMs('ORCA_BUILD_WEB_SESSION_POLL_MS', POLL_MS),
      stuckMs: envMs('ORCA_BUILD_WEB_SESSION_STUCK_MS', STUCK_MS),
      announceRemoved: (closed) => runtime.announceBuildWebSessionClosed(closed)
    })
    watcher.start()
    return watcher
  } catch (error) {
    console.warn('[build-web] the task session watcher did not start:', error)
    return null
  }
}
