import { useEffect } from 'react'
import { useAppStore } from '../../store'

// Why the active poll's cadence: each Claude account spends its own usage-endpoint budget, and each
// Codex probe starts a `codex` process; main also debounces repeats inside a minute.
const LOCAL_INACTIVE_REFRESH_MS = 15 * 60_000

/** Keeps this computer's inactive accounts' usage current while the footer shows them all. */
export function useLocalInactiveAccountRefresh(enabled: boolean): void {
  const fetchClaude = useAppStore((s) => s.fetchInactiveClaudeAccountUsage)
  const fetchCodex = useAppStore((s) => s.fetchInactiveCodexAccountUsage)
  useEffect(() => {
    if (!enabled) {
      return
    }
    const refresh = (): void => {
      if (!document.hidden) {
        void fetchClaude()
        void fetchCodex()
      }
    }
    refresh()
    const timer = window.setInterval(refresh, LOCAL_INACTIVE_REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [enabled, fetchClaude, fetchCodex])
}
