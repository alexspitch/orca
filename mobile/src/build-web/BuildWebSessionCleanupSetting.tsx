import { useCallback, useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { BUILD_WEB_WORKTREE_TASK_RUNTIME_CAPABILITY } from '../../../src/shared/build-web-capability'
import { BUILD_WEB_AGENT_SESSION_LIFECYCLE_FEATURE } from '../../../src/shared/build-web-session-types'
import { MobileSwitch } from '../components/MobileSwitch'
import { colors, spacing, typography } from '../theme/mobile-theme'
import { buildWebErrorMessage } from './build-web-operations'
import type { BuildWebScreen } from './build-web-screen-context'
import { useHostConsoleFeatures } from './use-console-features'

export type SessionCleanupSetting = {
  value: boolean
  busy: boolean
  error: string | null
  change: (next: boolean) => void
}

/**
 * «Auto-remove finished task workspaces» (IS-147): the token owner's choice, kept by the console.
 * Null — hidden — unless both the host and its console follow task sessions.
 */
export function useSessionCleanupSetting(
  hostId: string,
  hostCapabilities: readonly string[],
  call: BuildWebScreen['call'] | null
): SessionCleanupSetting | null {
  const features = useHostConsoleFeatures(hostId, hostCapabilities, call)
  const served =
    call !== null &&
    hostCapabilities.includes(BUILD_WEB_WORKTREE_TASK_RUNTIME_CAPABILITY) &&
    features.includes(BUILD_WEB_AGENT_SESSION_LIFECYCLE_FEATURE)
  const [value, setValue] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!served || !call) {
      return
    }
    let alive = true
    call('agentSessionSettings').then(
      (result) => {
        if (alive && result.ok) {
          setValue(result.value.auto_cleanup)
        }
      },
      () => {}
    )
    return () => {
      alive = false
    }
  }, [call, served])
  const change = useCallback(
    (next: boolean) => {
      if (!call) {
        return
      }
      setBusy(true)
      setError(null)
      setValue(next)
      void call('setAgentSessionSettings', { auto_cleanup: next })
        .then(
          (result) => {
            setValue(result.ok ? result.value.auto_cleanup : !next)
            setError(result.ok ? null : result.error)
          },
          (failure: unknown) => {
            setValue(!next)
            setError(buildWebErrorMessage(failure))
          }
        )
        .finally(() => setBusy(false))
    },
    [call]
  )
  return served && value !== null ? { value, busy, error, change } : null
}

export function BuildWebSessionCleanupSwitch({ setting }: { setting: SessionCleanupSetting }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.text}>
          <Text style={styles.title}>Auto-remove finished task workspaces</Text>
          <Text style={styles.hint}>
            When a task is closed, its worktree is removed if it holds no changes or commits of its
            own. Saved in build-web for this account.
          </Text>
        </View>
        <MobileSwitch
          value={setting.value}
          disabled={setting.busy}
          onValueChange={setting.change}
          accessibilityLabel="Auto-remove finished task workspaces"
        />
      </View>
      {setting.error ? <Text style={styles.error}>{setting.error}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  text: { flex: 1, gap: 2 },
  title: { color: colors.textPrimary, fontSize: typography.bodySize },
  hint: { color: colors.textMuted, fontSize: typography.metaSize, lineHeight: 17 },
  error: { color: colors.statusRed, fontSize: typography.metaSize }
})
