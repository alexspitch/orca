// IS-230.23, after build-web's image-links.ts: «Copy links» asks for a distribution, and a ticked rhel
// row gives its redos twin — a twin goes out with its rhel build and is rarely ticked on its own.

export type BuildWebDistChoice = 'rhel' | 'redos' | 'both'

export const BUILD_WEB_DIST_CHOICES: readonly BuildWebDistChoice[] = ['rhel', 'redos', 'both']

/** One side of a pick: its distribution, its references and whether the registry has them. */
export type LinkedSide = { dist: string; refs: string[]; pushed: boolean }

export type DistLink = { ref: string; pushed: boolean }

/** The references of the picks in the chosen distribution, each once: a pick's own, then its pair's. */
export function linksByDist(
  picks: readonly { own: LinkedSide; pair: LinkedSide | null }[],
  choice: BuildWebDistChoice
): DistLink[] {
  const out = new Map<string, DistLink>()
  for (const pick of picks) {
    for (const side of [pick.own, pick.pair]) {
      if (!side || (choice !== 'both' && side.dist !== choice)) {
        continue
      }
      for (const ref of side.refs) {
        if (!out.has(ref)) {
          out.set(ref, { ref, pushed: side.pushed })
        }
      }
    }
  }
  return [...out.values()]
}
