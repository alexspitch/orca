import { useEffect, useState } from 'react'
import type { RuntimeClientTarget } from '../../../../../../shared/runtime-client-target'
import { callBuildWeb } from '../../build-web-client'
import { guideShotSlugs } from '../issue-card-facts'

type Shots = { urls: Record<string, string>; missing: ReadonlySet<string> }
const NONE: Shots = { urls: {}, missing: new Set() }

/**
 * The guide's screenshots as blob URLs, read with the token in main; revoked when the guide moves
 * on. `version` reads them again — a frame shot anew keeps its name, so the name alone would keep
 * showing the old picture.
 */
export function useShotUrls(
  target: RuntimeClientTarget,
  runId: string,
  markdown: string,
  version: number
): Shots {
  const [shots, setShots] = useState<Shots>(NONE)
  const slugsKey = guideShotSlugs(markdown).join('|')
  useEffect(() => {
    let alive = true
    const made: string[] = []
    void (async () => {
      const urls: Record<string, string> = {}
      const missing = new Set<string>()
      for (const slug of slugsKey ? slugsKey.split('|') : []) {
        const shot = await callBuildWeb(target, 'guideShot', { runId, slug }).catch(() => null)
        if (!alive) {
          return
        }
        if (shot) {
          const bytes = Uint8Array.from(atob(shot.base64), (c) => c.charCodeAt(0))
          urls[slug] = URL.createObjectURL(new Blob([bytes], { type: shot.mime }))
          made.push(urls[slug])
        } else {
          missing.add(slug)
        }
      }
      if (alive) {
        setShots({ urls, missing })
      }
    })()
    return () => {
      alive = false
      made.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [runId, slugsKey, target, version])
  return shots
}
