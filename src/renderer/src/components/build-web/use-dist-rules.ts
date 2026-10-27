import { useEffect, useMemo } from 'react'
import { create } from 'zustand'
import { distRulesOf, type DistRules } from '../../../../shared/build-web-repos'
import type { RuntimeClientTarget } from '../../../../shared/runtime-client-target'
import { callBuildWeb } from './build-web-client'

// The console's `features`, read once per host: they decide whether the monorepo still offers redos.

const keyOf = (target: RuntimeClientTarget) =>
  target.kind === 'local' ? 'local' : `env:${target.environmentId}`

const useConsoleFeatures = create<{ byHost: Record<string, readonly string[]> }>()(() => ({
  byHost: {}
}))

/** The distribution rules of the console behind `target`; an older one, or one not read yet, has none. */
export function useDistRules(target: RuntimeClientTarget): DistRules {
  const key = keyOf(target)
  const features = useConsoleFeatures((s) => s.byHost[key])
  useEffect(() => {
    let alive = true
    void callBuildWeb(target, 'consoleFeatures').then(
      (next) =>
        alive && useConsoleFeatures.setState((s) => ({ byHost: { ...s.byHost, [key]: next } })),
      // Why: an older host or console answers nothing, and the old rules stay.
      () => {}
    )
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per host; `target` is a fresh object each render.
  }, [key])
  return useMemo(() => distRulesOf(features ?? []), [features])
}
