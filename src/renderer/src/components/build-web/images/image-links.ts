import type { BuildWebImageBuild } from '../../../../../shared/build-web-image-types'

/** The build's own reference, `<registry>/<image>:<ver>b<N>`; null while it has no image. */
export const imageRefOf = (build: BuildWebImageBuild): string | null =>
  build.status === 'success' ? build.ref : null

/** The references of the picked builds, in pick order, each once. */
export const imageLinksOf = (builds: readonly BuildWebImageBuild[]): string[] => [
  ...new Set(builds.flatMap((b) => imageRefOf(b) ?? []))
]

/** Picked builds whose reference the registry does not answer yet. */
export const unpushedLinkCount = (builds: readonly BuildWebImageBuild[]): number =>
  new Set(builds.filter((b) => imageRefOf(b) && !b.pushed_build_tag).map(imageRefOf)).size
