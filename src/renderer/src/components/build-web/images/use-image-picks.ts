import { useState } from 'react'
import type { BuildWebImageBuild } from '../../../../../shared/build-web-image-types'
import { isPushable } from '../../../../../shared/build-web-image-push'

/** Builds picked for a push or for their links, kept with their data so a pick on another page still counts. */
export function useImagePicks(): {
  has: (key: string) => boolean
  toggle: (key: string, build: BuildWebImageBuild | null) => void
  /** Every pick, in pick order: what «Copy links» copies. */
  builds: BuildWebImageBuild[]
  /** The picks a push can still add a tag for. */
  pushable: BuildWebImageBuild[]
  clear: () => void
  /** Drop every pick but the builds `keep` names: what a push left behind stays picked. */
  keepOnly: (keep: (build: BuildWebImageBuild) => boolean) => void
} {
  const [picked, setPicked] = useState<ReadonlyMap<string, BuildWebImageBuild>>(new Map())
  const builds = [...picked.values()]
  return {
    has: (key) => picked.has(key),
    toggle: (key, build) =>
      setPicked((current) => {
        const next = new Map(current)
        if (!next.delete(key) && build) {
          next.set(key, build)
        }
        return next
      }),
    builds,
    pushable: builds.filter(isPushable),
    clear: () => setPicked(new Map()),
    keepOnly: (keep) => setPicked((current) => new Map([...current].filter(([, b]) => keep(b))))
  }
}
