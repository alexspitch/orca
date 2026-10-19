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
  selectedKey: string | null
  tab: StandTab
  /** The operation followed on each stand, by group key. */
  jobs: Record<string, BuildWebJob>
  load: (target: RuntimeClientTarget, contextKey: string, force?: boolean) => Promise<void>
  select: (key: string | null) => void
  setTab: (tab: StandTab) => void
  setJob: (key: string, job: BuildWebJob | null) => void
}

let generation = 0
const prefs = readStandViewPrefs()

export const useStandGroups = create<StandGroupsState>()((set, get) => ({
  contextKey: null,
  groups: null,
  error: null,
  loading: false,
  loadedAt: 0,
  selectedKey: prefs.selectedKey,
  tab: prefs.tab,
  jobs: {},
  load: async (target, contextKey, force = false) => {
    const state = get()
    const sameHost = state.contextKey === contextKey
    if (!force && sameHost && state.groups && Date.now() - state.loadedAt < FRESH_MS) {
      return
    }
    const mine = ++generation
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
  setJob: (key, job) =>
    set((state) => {
      const { [key]: _previous, ...rest } = state.jobs
      return { jobs: job ? { ...rest, [key]: job } : rest }
    })
}))
