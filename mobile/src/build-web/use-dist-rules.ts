import { useEffect, useMemo, useState } from 'react'
import { BUILD_WEB_CONSOLE_FEATURES_RUNTIME_CAPABILITY } from '../../../src/shared/build-web-capability'
import { distRulesOf, type DistRules } from '../../../src/shared/build-web-repos'
import { useBuildWebScreen } from './build-web-screen-context'

// The console's `features`, read once per host as the desktop does: they decide whether the
// monorepo still offers redos. Kept across screens so a card does not flash the old choice.
const known = new Map<string, readonly string[]>()

/** The distribution rules of the host's console; an older host or console, or one not read yet, has none. */
export function useDistRules(): DistRules {
  const { hostId, hostCapabilities, call } = useBuildWebScreen()
  const [features, setFeatures] = useState<readonly string[]>(() => known.get(hostId) ?? [])
  const served = hostCapabilities.includes(BUILD_WEB_CONSOLE_FEATURES_RUNTIME_CAPABILITY)
  useEffect(() => {
    if (!served) {
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
      // Why: a console that cannot say keeps the old rules.
      () => {}
    )
    return () => {
      alive = false
    }
  }, [call, hostId, served])
  return useMemo(() => distRulesOf(features), [features])
}
