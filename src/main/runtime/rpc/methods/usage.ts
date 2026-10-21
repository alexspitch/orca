import {
  UsageRefreshParams,
  UsageSnapshotParams
} from '../../../../shared/rpc-contract/usage-params'
import { getInstalledUsageStore } from '../../../usage/installed-usage-stores'
import { defineMethod } from '../core'

// Why: a client that shows usage across hosts reads each host's own transcripts here; null is a
// host without usage stores.
export const USAGE_METHODS = [
  defineMethod({
    name: 'usage.snapshot',
    permission: 'workspace',
    params: UsageSnapshotParams,
    handler: async ({ provider, scope, range, limit }) => {
      const store = getInstalledUsageStore(provider)
      if (!store) {
        return null
      }
      await store.whenLoaded()
      return store.getSnapshot(scope, range, limit)
    }
  }),
  // Why it enables: the client asks only while tracking is on there, so its switch covers this host.
  defineMethod({
    name: 'usage.refresh',
    permission: 'workspace',
    params: UsageRefreshParams,
    handler: async ({ provider, force }) => {
      const store = getInstalledUsageStore(provider)
      if (!store) {
        return null
      }
      await store.whenLoaded()
      if (!store.getScanState().enabled) {
        await store.setEnabled(true)
      }
      return await store.refresh(force ?? false)
    }
  })
]
