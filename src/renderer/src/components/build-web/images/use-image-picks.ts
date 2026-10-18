import { useState } from 'react'
import type { BuildWebImageBuild } from '../../../../../shared/build-web-image-types'
import { isPushable } from '../../../../../shared/build-web-image-push'

/** Builds picked for a push, kept with their data so a pick on another page still goes out. */
export function useImagePicks(): {
  has: (key: string) => boolean
  toggle: (key: string, build: BuildWebImageBuild | null) => void
  builds: BuildWebImageBuild[]
  clear: () => void
} {
  const [picked, setPicked] = useState<ReadonlyMap<string, BuildWebImageBuild>>(new Map())
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
    builds: [...picked.values()].filter(isPushable),
    clear: () => setPicked(new Map())
  }
}
