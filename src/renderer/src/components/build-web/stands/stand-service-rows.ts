import type { BuildWebStandService } from '../../../../../shared/build-web-stand-types'
import type { ChipTone } from '../build-web-tones'

// How a stand's services read in the table: the state's colour, the image split for the eye, and
// the build number out of the immutable tag.

export function serviceStateTone(service: BuildWebStandService): ChipTone {
  if (service.state === 'running') {
    if (service.health === 'unhealthy') {
      return 'red'
    }
    return service.health === 'starting' ? 'amber' : 'green'
  }
  switch (service.state) {
    case 'restarting':
      return 'amber'
    case 'exited':
    case 'dead':
      return 'red'
    case 'absent':
      return 'faint'
    default:
      return 'neutral'
  }
}

export function serviceStateLabel(service: BuildWebStandService): string {
  return service.health && service.state === 'running'
    ? `${service.state} · ${service.health}`
    : service.state
}

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
