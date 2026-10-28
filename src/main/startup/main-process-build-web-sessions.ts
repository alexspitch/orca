import { installBuildWebSessionReports } from '../build-web/build-web-session-reports'
import { BuildWebSessionWatcher } from '../build-web/build-web-session-watcher'
import { mainProcessState as state } from './main-process-state'

// IS-147: the task-session watcher and its report queue, for the desktop app and `orca serve` alike.

const POLL_MS = 60_000
const STUCK_MS = 24 * 60 * 60_000

/** E2E shortens the poll and the «stuck for a day» threshold through the environment. */
function envMs(name: string, fallback: number): number {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value > 0 ? value : fallback
}

export function startBuildWebSessionWatcher(): void {
  const { store, runtime } = state
  if (!store || !runtime) {
    return
  }
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
    state.buildWebSessionWatcher = watcher
  } catch (error) {
    console.warn('[build-web] the task session watcher did not start:', error)
  }
}

export function stopBuildWebSessionWatcher(): void {
  state.buildWebSessionWatcher?.stop()
  state.buildWebSessionWatcher = null
}
