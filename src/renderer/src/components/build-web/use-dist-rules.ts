import { useMemo } from 'react'
import { distRulesOf, type DistRules } from '../../../../shared/build-web-repos'
import type { RuntimeClientTarget } from '../../../../shared/runtime-client-target'
import { useConsoleFeatures } from './use-console-features'

// The console's features decide whether the monorepo still offers redos.

/** The distribution rules of the console behind `target`; an older one, or one not read yet, has none. */
export function useDistRules(target: RuntimeClientTarget): DistRules {
  const features = useConsoleFeatures(target)
  return useMemo(() => distRulesOf(features ?? []), [features])
}
