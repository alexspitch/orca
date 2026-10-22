import type { BuildWebImageBuild } from './build-web-image-types'
import type {
  BuildWebStandHealth,
  BuildWebStandService,
  BuildWebStandStatus,
  BuildWebStandUpdate
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

const registryOf = (host: string | null) => host ?? 'docker.io'

/**
 * The newest build the registry's moving tag (`3.1`) points past the one the container runs, so
 * a pull and `up -d` would change it; null when there is none. `builds` are the console's.
 */
export function newerImageOf(
  service: BuildWebStandService,
  builds: readonly BuildWebImageBuild[]
): string | null {
  const running = Number(buildNumberOf(service.build))
  if (!running) {
    return null
  }
  const wanted = imagePartsOf(service.image)
  let newest: { tag: string; number: number } | null = null
  for (const b of builds) {
    if (b.status !== 'success' || !b.pushed_main_tag || !b.ref) {
      continue
    }
    // Why the registry too: each distribution has its own (rhel's docker.spitch.ch, redos's
    // docker.voice.bssys.com) under the same path, and their build numbers interleave.
    const parts = imagePartsOf(b.ref)
    const number = Number(buildNumberOf(parts.tag))
    if (
      registryOf(parts.host) === registryOf(wanted.host) &&
      parts.path === wanted.path &&
      parts.tag.startsWith(`${wanted.tag}b`) &&
      number > running &&
      number > (newest?.number ?? 0)
    ) {
      newest = { tag: parts.tag, number }
    }
  }
  return newest?.tag ?? null
}

/** Running services the compose files or the registry have moved past. */
export function standUpdatesOf(
  status: BuildWebStandStatus,
  builds: readonly BuildWebImageBuild[]
): BuildWebStandUpdate[] {
  return status.services.flatMap((s): BuildWebStandUpdate[] => {
    // Why running only: a stopped service picks up whatever is current when it starts.
    if (s.state !== 'running') {
      return []
    }
    const newer = newerImageOf(s, builds)
    return newer || isNotApplied(s)
      ? [{ service: s.service, image: s.image, running: s.build, newer }]
      : []
  })
}

export function standHealthOf(
  instance: string,
  status: BuildWebStandStatus,
  builds: readonly BuildWebImageBuild[]
): BuildWebStandHealth {
  const running = status.services.some((s) => s.state === 'running')
  if (!running) {
    return { instance, running, failing: 0, outdated: 0, updates: [], error: null }
  }
  const updates = standUpdatesOf(status, builds)
  return {
    instance,
    running,
    failing: status.services.filter(isFailingService).length,
    outdated: updates.length,
    updates,
    error: null
  }
}
