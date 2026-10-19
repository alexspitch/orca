import { create } from 'zustand'

/** A test job's log reads as one, and opens in the browser at its run, not at the JSON route. */
type LogOptions = { kind: 'test'; webUrl: string }

type ShownLog = { url: string; title: string } & Partial<LogOptions>

/** The build log shown in the log dialog; one at a time, opened from any table that lists builds. */
type BuildLogViewer = {
  log: ShownLog | null
  show: (url: string, title: string, options?: LogOptions) => void
  hide: () => void
}

export const useBuildLogViewer = create<BuildLogViewer>()((set) => ({
  log: null,
  show: (url, title, options) => set({ log: { url, title, ...options } }),
  hide: () => set({ log: null })
}))
