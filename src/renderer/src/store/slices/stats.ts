import type { StateCreator } from 'zustand'
import type { AppState } from '../types'
import type { StatsSummary } from '../../../../shared/process-stats-types'
import { clearUsageProviderData } from './usage-provider-data'
import {
  isSameUsageSource,
  LOCAL_USAGE_SOURCE,
  usageServersKey,
  type UsageServer,
  type UsageSource
} from './usage-hosts/usage-host-types'

export type StatsSlice = {
  statsSummary: StatsSummary | null
  fetchStatsSummary: () => Promise<void>
  /** Whose agent transcripts the usage panes read. */
  usageSource: UsageSource
  /** Connected paired servers, kept current by the Stats pane while it is open. */
  usageServers: readonly UsageServer[]
  setUsageSource: (source: UsageSource) => void
  setUsageServers: (servers: readonly UsageServer[]) => void
}

export const createStatsSlice: StateCreator<AppState, [], [], StatsSlice> = (set, get) => ({
  statsSummary: null,
  usageSource: LOCAL_USAGE_SOURCE,
  usageServers: [],

  fetchStatsSummary: async () => {
    try {
      const summary = await window.api.stats.getSummary()
      set({ statsSummary: summary })
    } catch (err) {
      console.error('Failed to fetch stats summary:', err)
    }
  },

  setUsageSource: (source) => {
    if (isSameUsageSource(get().usageSource, source)) {
      return
    }
    set({ ...clearUsageProviderData(get()), usageSource: source })
  },

  // Why compared: status polls rebuild the list with the same servers in it.
  setUsageServers: (servers) => {
    if (usageServersKey(get().usageServers) !== usageServersKey(servers)) {
      set({ usageServers: servers })
    }
  }
})
