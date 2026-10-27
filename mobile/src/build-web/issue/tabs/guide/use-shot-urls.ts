import { useEffect, useState } from 'react'
import { guideShotSlugs } from '../../../../../../src/renderer/src/components/build-web/issue/issue-card-facts'
import { useBuildWebScreen } from '../../../build-web-screen-context'

export const SHOT_URL_PREFIX = 'orca-guide-shot:'

type Shots = {
  /** Slug → a stand-in URL the preview resolves; keeps the frame's bytes out of the Markdown. */
  urls: Record<string, string>
  missing: ReadonlySet<string>
  /** Stand-in URL → the frame as a data URI. */
  sources: ReadonlyMap<string, string>
}
const NONE: Shots = { urls: {}, missing: new Set(), sources: new Map() }

/**
 * The guide's screenshots. `version` reads them again — a frame shot anew keeps its name, so the
 * name alone would keep showing the old picture.
 */
export function useShotUrls(runId: string, markdown: string, version: number): Shots {
  const { call } = useBuildWebScreen()
  const [shots, setShots] = useState<Shots>(NONE)
  const slugsKey = guideShotSlugs(markdown).join('|')
  useEffect(() => {
    let alive = true
    void (async () => {
      const urls: Record<string, string> = {}
      const missing = new Set<string>()
      const sources = new Map<string, string>()
      for (const slug of slugsKey ? slugsKey.split('|') : []) {
        const shot = await call('guideShot', { runId, slug }).catch(() => null)
        if (!alive) {
          return
        }
        if (shot) {
          urls[slug] = `${SHOT_URL_PREFIX}${slug}?v=${version}`
          sources.set(urls[slug], `data:${shot.mime};base64,${shot.base64}`)
        } else {
          missing.add(slug)
        }
      }
      if (alive) {
        setShots({ urls, missing, sources })
      }
    })()
    return () => {
      alive = false
    }
  }, [call, runId, slugsKey, version])
  return shots
}
