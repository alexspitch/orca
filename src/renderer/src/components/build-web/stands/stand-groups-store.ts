import { create } from 'zustand'
import type { BuildWebStandGroup } from '../../../../../shared/build-web-stand-types'
import type { BuildWebJob } from '../../../../../shared/build-web-task-types'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import { callBuildWeb } from '../build-web-client'
import { readStandViewPrefs, writeStandViewPrefs, type StandTab } from './stand-view-prefs'

// The stands directory and the stand picked on the page.

// Why: the directory changes when someone edits a card in build-web — rarely.
const FRESH_MS = 60_000

type StandGroupsState = {
  contextKey: string | null
  groups: BuildWebStandGroup[] | null
  error: string | null
  loading: boolean
  loadedAt: number
  /** Bumped by every forced read, so what hangs off the directory reads again with it. */
  refreshes: number
  selectedKey: string | null
  tab: StandTab
  hiddenKeys: string[]
  showHidden: boolean
  /** The operation followed on each stand, by group key. */
  jobs: Record<string, BuildWebJob>
  load: (target: RuntimeClientTarget, contextKey: string, force?: boolean) => Promise<void>
  select: (key: string | null) => void
  setTab: (tab: StandTab) => void
  setHidden: (key: string, hidden: boolean) => void
  setShowHidden: (show: boolean) => void
  setJob: (key: string, job: BuildWebJob | null) => void
  /** Read the monitoring again past the host's cache: an operation changed what the stands run. */
  refreshHealth: () => void
}

let generation = 0
const prefs = readStandViewPrefs()

export const useStandGroups = create<StandGroupsState>()((set, get) => ({
  contextKey: null,
  groups: null,
  error: null,
  loading: false,
  loadedAt: 0,
  refreshes: 0,
  selectedKey: prefs.selectedKey,
  tab: prefs.tab,
  hiddenKeys: prefs.hiddenKeys,
  showHidden: prefs.showHidden,
  jobs: {},
  load: async (target, contextKey, force = false) => {
    const state = get()
    const sameHost = state.contextKey === contextKey
    if (!force && sameHost && state.groups && Date.now() - state.loadedAt < FRESH_MS) {
      return
    }
    const mine = ++generation
    if (force) {
      set((s) => ({ refreshes: s.refreshes + 1 }))
    }
    set(sameHost ? { loading: true } : { contextKey, groups: null, error: null, loading: true })
    try {
      const result = await callBuildWeb(target, 'standGroups')
      if (mine !== generation) {
        return
      }
      set(
        result.ok
          ? { groups: result.value, error: null, loading: false, loadedAt: Date.now() }
          : { error: result.error, loading: false }
      )
    } catch (failure) {
      if (mine === generation) {
        set({ error: failure instanceof Error ? failure.message : String(failure), loading: false })
      }
    }
  },
  select: (key) => {
    writeStandViewPrefs({ selectedKey: key })
    set({ selectedKey: key })
  },
  setTab: (tab) => {
    writeStandViewPrefs({ tab })
    set({ tab })
  },
  setHidden: (key, hidden) => {
    const rest = get().hiddenKeys.filter((k) => k !== key)
    const hiddenKeys = hidden ? [...rest, key] : rest
    writeStandViewPrefs({ hiddenKeys })
    set({ hiddenKeys })
  },
  setShowHidden: (showHidden) => {
    writeStandViewPrefs({ showHidden })
    set({ showHidden })
  },
  setJob: (key, job) =>
    set((state) => {
      const { [key]: _previous, ...rest } = state.jobs
      return { jobs: job ? { ...rest, [key]: job } : rest }
    }),
  refreshHealth: () => set((s) => ({ refreshes: s.refreshes + 1 }))
}))
