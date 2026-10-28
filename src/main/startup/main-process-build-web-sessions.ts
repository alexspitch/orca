import { startBuildWebSessionService } from '../build-web/build-web-session-service'
import { mainProcessState as state } from './main-process-state'

export function startBuildWebSessionWatcher(): void {
  const { store, runtime } = state
  if (store && runtime) {
    state.buildWebSessionWatcher = startBuildWebSessionService(store, runtime)
  }
}

export function stopBuildWebSessionWatcher(): void {
  state.buildWebSessionWatcher?.stop()
  state.buildWebSessionWatcher = null
}
