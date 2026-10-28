import { useEffect, useState } from 'react'
import { Switch } from '@/components/ui/switch'
import { translate } from '@/i18n/i18n'
import type { RuntimeClientTarget } from '../../../../shared/runtime-client-target'
import { BUILD_WEB_AGENT_SESSION_LIFECYCLE_FEATURE } from '../../../../shared/build-web-session-types'
import { callBuildWeb } from '../build-web/build-web-client'
import { useConsoleFeatures } from '../build-web/use-console-features'

const keyOf = (target: RuntimeClientTarget) =>
  target.kind === 'local' ? 'local' : `env:${target.environmentId}`

/**
 * «Auto-remove finished task workspaces» (IS-147): the token owner's choice, kept by the console.
 * Shown only where both the host and the console follow task sessions.
 */
export function BuildWebSessionCleanupSetting({
  target
}: {
  target: RuntimeClientTarget
}): React.JSX.Element | null {
  const key = keyOf(target)
  const features = useConsoleFeatures(target)
  const served = features?.includes(BUILD_WEB_AGENT_SESSION_LIFECYCLE_FEATURE) === true
  const [value, setValue] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!served) {
      return
    }
    let alive = true
    void callBuildWeb(target, 'agentSessionSettings').then(
      (result) => alive && result.ok && setValue(result.value.auto_cleanup),
      // Why: a host that does not follow task sessions refuses the call, and the row stays hidden.
      () => {}
    )
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per host; `target` is a fresh object each render.
  }, [key, served])
  if (!served || value === null) {
    return null
  }
  const change = async (next: boolean): Promise<void> => {
    setBusy(true)
    setError(null)
    setValue(next)
    const result = await callBuildWeb(target, 'setAgentSessionSettings', {
      auto_cleanup: next
    }).catch((failure: unknown) => ({
      ok: false as const,
      error: failure instanceof Error ? failure.message : String(failure)
    }))
    setValue(result.ok ? result.value.auto_cleanup : !next)
    setError(result.ok ? null : result.error)
    setBusy(false)
  }
  return (
    <div className="flex flex-col gap-1">
      <label className="flex items-center justify-between gap-3 text-sm">
        <span>
          <span className="block">
            {translate('buildWeb.settings.autoCleanup', 'Auto-remove finished task workspaces')}
          </span>
          <span className="block text-xs text-muted-foreground">
            {translate(
              'buildWeb.settings.autoCleanupHint',
              'When a task is closed, its worktree is removed if it holds no changes or commits of its own. Saved in build-web for this account.'
            )}
          </span>
        </span>
        <Switch
          checked={value}
          disabled={busy}
          onCheckedChange={(checked) => void change(checked)}
        />
      </label>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
