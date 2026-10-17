import type { BuildWebImageBuild, BuildWebImagePushArgs } from './build-web-image-types'

// Publishing builds to the registry, after build-web's web/src/image-push.ts: a build is pushed by
// the run that holds it, and «main tag» means something only where the moving tag can still go.

/** A finished build a push can still add a tag for. */
export function isPushable(build: BuildWebImageBuild): boolean {
  if (build.status !== 'success' || !build.ref) {
    return false
  }
  return !build.pushed_build_tag || (!build.pushed_main_tag && !build.main_tag_on)
}

const mainTagMovable = (b: BuildWebImageBuild) =>
  isPushable(b) && !b.pushed_main_tag && !b.main_tag_on

export const offersBuildTagOnly = (builds: BuildWebImageBuild[]) =>
  builds.some((b) => isPushable(b) && !b.pushed_build_tag)

export const offersMainTag = (builds: BuildWebImageBuild[]) => builds.some(mainTagMovable)

/** One push request per run; a build-tag-only push skips builds that already have their tag. */
export function pushRequests(
  builds: BuildWebImageBuild[],
  moveMainTag: boolean
): BuildWebImagePushArgs[] {
  const byRun = new Map<string, BuildWebImagePushArgs['combos']>()
  for (const b of builds) {
    if (!isPushable(b) || (!moveMainTag && b.pushed_build_tag)) {
      continue
    }
    const combos = byRun.get(b.run_id) ?? []
    if (!combos.some((c) => c.image === b.image && c.dist === b.dist && c.branch === b.branch)) {
      combos.push({ image: b.image, dist: b.dist, branch: b.branch })
    }
    byRun.set(b.run_id, combos)
  }
  return [...byRun].map(([runId, combos]) => ({ runId, combos, moveMainTag }))
}
