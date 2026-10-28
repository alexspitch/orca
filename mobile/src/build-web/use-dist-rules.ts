import { useMemo } from 'react'
import { distRulesOf, type DistRules } from '../../../src/shared/build-web-repos'
import { useConsoleFeatures } from './use-console-features'

// The console's features decide whether the monorepo still offers redos, as on the desktop.

/** The distribution rules of the host's console; an older host or console, or one not read yet, has none. */
export function useDistRules(): DistRules {
  const features = useConsoleFeatures()
  return useMemo(() => distRulesOf(features), [features])
}
