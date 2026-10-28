import { useEffect, useState } from 'react'
import { BUILD_WEB_CONSOLE_FEATURES_RUNTIME_CAPABILITY } from '../../../src/shared/build-web-capability'
import { useBuildWebScreen, type BuildWebScreen } from './build-web-screen-context'

// The console's `features`, read once per host as the desktop does. Kept across screens so a card
// does not flash the old choice.
const known = new Map<string, readonly string[]>()

/** The features of a host's console; empty for an older host or console, one not read yet, or no `call`. */
export function useHostConsoleFeatures(
  hostId: string,
  hostCapabilities: readonly string[],
  call: BuildWebScreen['call'] | null
): readonly string[] {
  const [features, setFeatures] = useState<readonly string[]>(() => known.get(hostId) ?? [])
  const served = hostCapabilities.includes(BUILD_WEB_CONSOLE_FEATURES_RUNTIME_CAPABILITY)
  useEffect(() => {
    if (!served || !call) {
      return
    }
    let alive = true
    call('consoleFeatures').then(
      (next) => {
        known.set(hostId, next)
        if (alive) {
          setFeatures(next)
        }
      },
      // Why: a console that cannot say keeps what depends on it as before.
      () => {}
    )
    return () => {
      alive = false
    }
  }, [call, hostId, served])
  return features
}

/** The features of the screen's host's console. */
export function useConsoleFeatures(): readonly string[] {
  const { hostId, hostCapabilities, call } = useBuildWebScreen()
  return useHostConsoleFeatures(hostId, hostCapabilities, call)
}
