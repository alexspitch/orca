import { create } from 'zustand'

/** The build log shown in the log dialog; one at a time, opened from any table that lists builds. */
type BuildLogViewer = {
  log: { url: string; title: string } | null
  show: (url: string, title: string) => void
  hide: () => void
}

export const useBuildLogViewer = create<BuildLogViewer>()((set) => ({
  log: null,
  show: (url, title) => set({ log: { url, title } }),
  hide: () => set({ log: null })
}))
