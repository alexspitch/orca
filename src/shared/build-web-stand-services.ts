import type { BuildWebImageBuild } from './build-web-image-types'
import type {
  BuildWebStandHealth,
  BuildWebStandService,
  BuildWebStandStatus
} from './build-web-stand-types'

// How a stand's services are judged: the table's colours and the monitoring counts read the same rules.

/** `docker.spitch.ch/dc/ib-script-engine:3.1` → host, path and tag; a digest stays on the path. */
export function imagePartsOf(ref: string): { host: string | null; path: string; tag: string } {
  const slash = ref.lastIndexOf('/')
  const colon = ref.lastIndexOf(':')
  const named = colon > slash ? ref.slice(0, colon) : ref
  const tag = colon > slash ? ref.slice(colon + 1) : 'latest'
  const first = named.indexOf('/')
  const head = first > 0 ? named.slice(0, first) : ''
  // Docker's own rule: the first segment is a registry only when it looks like one.
  const isHost = head.includes('.') || head.includes(':') || head === 'localhost'
  return isHost
    ? { host: head, path: named.slice(first + 1), tag }
    : { host: null, path: named, tag }
}

/** `3.1b11830` → `11830`; null for a tag with no build number. */
export function buildNumberOf(build: string | null): string | null {
  return build ? (/b(\d+)$/.exec(build)?.[1] ?? null) : null
}

/** The container runs something other than what the compose files now name. */
export function isNotApplied(service: BuildWebStandService): boolean {
  return service.runningImage !== null && service.runningImage !== service.image
}

/** Down or unhealthy: what the table paints red. */
export function isFailingService(service: BuildWebStandService): boolean {
  if (service.state === 'running') {
    return service.health === 'unhealthy'
  }
  return service.state === 'exited' || service.state === 'dead'
}

/**
 * The registry's moving tag (`3.1`) now points at a newer build than the container runs, so
 * `up -d` after a pull would change it. `builds` are the console's, newest first.
 */
export function hasNewerImage(
  service: BuildWebStandService,
  builds: readonly BuildWebImageBuild[]
): boolean {
  const running = Number(buildNumberOf(service.build))
  if (!running) {
    return false
  }
  const wanted = imagePartsOf(service.image)
  return builds.some((b) => {
    if (b.status !== 'success' || !b.pushed_main_tag || !b.ref) {
      return false
    }
    // Why the path alone: the console may name the registry differently than the compose files.
    const parts = imagePartsOf(b.ref)
    return (
      parts.path === wanted.path &&
      parts.tag.startsWith(`${wanted.tag}b`) &&
      Number(buildNumberOf(parts.tag)) > running
    )
  })
}

export function standHealthOf(
  status: BuildWebStandStatus,
  builds: readonly BuildWebImageBuild[]
): BuildWebStandHealth {
  const running = status.services.some((s) => s.state === 'running')
  if (!running) {
    return { running, failing: 0, outdated: 0, error: null }
  }
  return {
    running,
    failing: status.services.filter(isFailingService).length,
    outdated: status.services.filter((s) => isNotApplied(s) || hasNewerImage(s, builds)).length,
    error: null
  }
}
