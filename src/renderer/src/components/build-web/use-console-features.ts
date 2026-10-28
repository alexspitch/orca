import { useEffect } from 'react'
import { create } from 'zustand'
import type { RuntimeClientTarget } from '../../../../shared/runtime-client-target'
import { callBuildWeb } from './build-web-client'

// The console's `features`, read once per host: what the console behind it serves beyond the old API.

const keyOf = (target: RuntimeClientTarget) =>
  target.kind === 'local' ? 'local' : `env:${target.environmentId}`

const useFeaturesByHost = create<{ byHost: Record<string, readonly string[]> }>()(() => ({
  byHost: {}
}))

/** The features of the console behind `target`; undefined while unread or when the host cannot say. */
export function useConsoleFeatures(target: RuntimeClientTarget): readonly string[] | undefined {
  const key = keyOf(target)
  const features = useFeaturesByHost((s) => s.byHost[key])
  useEffect(() => {
    let alive = true
    void callBuildWeb(target, 'consoleFeatures').then(
      (next) =>
        alive && useFeaturesByHost.setState((s) => ({ byHost: { ...s.byHost, [key]: next } })),
      // Why: an older host or console answers nothing, and what depends on it stays as before.
      () => {}
    )
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per host; `target` is a fresh object each render.
  }, [key])
  return features
}
