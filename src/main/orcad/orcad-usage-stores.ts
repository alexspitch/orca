import { ClaudeUsageStore } from '../claude-usage/store'
import { CodexUsageStore } from '../codex-usage/store'
import { MuseUsageStore } from '../muse-usage/store'
import { OpenCodeUsageStore } from '../opencode-usage/store'
import type { Store } from '../persistence'
import { installUsageStores } from '../usage/installed-usage-stores'
import type { OrcadRuntimeCleanup } from './orcad-runtime-lifetime'

/**
 * This host's token usage, read from its own agent transcripts for a desktop showing several hosts.
 * Tracking starts off and is turned on by the first `usage.refresh`, i.e. by the desktop's switch.
 */
export function startOrcadUsageStores(
  store: Pick<Store, 'getRepos' | 'getAllWorktreeMeta'>,
  registerCleanup: (cleanup: OrcadRuntimeCleanup) => void
): void {
  const stores = {
    claude: new ClaudeUsageStore(store),
    codex: new CodexUsageStore(store),
    opencode: new OpenCodeUsageStore(store),
    muse: new MuseUsageStore(store)
  }
  installUsageStores(stores)
  registerCleanup(async () => {
    installUsageStores(null)
    await Promise.all(Object.values(stores).map((usage) => usage.flush()))
  })
}
