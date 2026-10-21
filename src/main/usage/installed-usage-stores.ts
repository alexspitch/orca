import type { UsageHostProvider } from '../../shared/rpc-contract/usage-params'

/** What the usage RPC methods read of a store; every agent's usage store has this shape. */
export type UsageHostStore = {
  whenLoaded: () => Promise<void>
  getScanState: () => { enabled: boolean }
  setEnabled: (enabled: boolean) => Promise<unknown>
  refresh: (force?: boolean) => Promise<unknown>
  getSnapshot: (
    scope: 'orca' | 'all',
    range: '7d' | '30d' | '90d' | 'all',
    limit?: number
  ) => unknown
}

export type InstalledUsageStores = Record<UsageHostProvider, UsageHostStore>

let installed: InstalledUsageStores | null = null

/** Installed by the host that owns the usage stores (the desktop's main process, or orcad). */
export function installUsageStores(stores: InstalledUsageStores | null): void {
  installed = stores
}

export function getInstalledUsageStore(provider: UsageHostProvider): UsageHostStore | null {
  return installed?.[provider] ?? null
}
