import {
  linksByDist,
  type BuildWebDistChoice,
  type DistLink,
  type LinkedSide
} from '../../../../../shared/build-web-dist-links'
import type {
  BuildWebImageBuild,
  BuildWebImagePair
} from '../../../../../shared/build-web-image-types'

/** The build's own reference, `<registry>/<image>:<ver>b<N>`; null while it has no image. */
export const imageRefOf = (build: BuildWebImagePair): string | null =>
  build.status === 'success' ? build.ref : null

function sideOf(build: BuildWebImagePair): LinkedSide {
  const ref = imageRefOf(build)
  return { dist: build.dist, refs: ref ? [ref] : [], pushed: build.pushed_build_tag }
}

/** The references of the picked builds in the chosen distribution, in pick order, each once; a rhel build gives its twin. */
export const imageLinksByDist = (
  builds: readonly BuildWebImageBuild[],
  choice: BuildWebDistChoice
): DistLink[] =>
  linksByDist(
    builds.map((b) => ({ own: sideOf(b), pair: b.pair ? sideOf(b.pair) : null })),
    choice
  )
