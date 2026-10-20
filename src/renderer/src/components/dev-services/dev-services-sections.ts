import type {
  DevServicesProfile,
  DevServicesService,
  DevServicesStatus
} from '../../../../shared/dev-services-contract'

export type DevServicesProfileGroup = {
  profile: DevServicesProfile
  services: DevServicesService[]
}

export type DevServicesGroups = {
  profiles: DevServicesProfileGroup[]
  /** Services no profile lists: started one at a time. */
  other: DevServicesService[]
}

/** A profile's own services in the order it lists them; `includes` stay in their own sections. */
export function groupDevServices(status: DevServicesStatus): DevServicesGroups {
  const byId = new Map(status.services.map((service) => [service.id, service]))
  const placed = new Set<string>()
  const profiles = status.profiles.map((profile) => {
    const listed = profile.services
      .map((id) => byId.get(id))
      .filter((service): service is DevServicesService => service !== undefined)
    const claimed = status.services.filter(
      (service) => service.profile === profile.id && !profile.services.includes(service.id)
    )
    const services = [...listed, ...claimed].filter((service) => !placed.has(service.id))
    for (const service of services) {
      placed.add(service.id)
    }
    return { profile, services }
  })
  return { profiles, other: status.services.filter((service) => !placed.has(service.id)) }
}

const RUNNING_STATES: ReadonlySet<DevServicesService['state']> = new Set([
  'ready',
  'starting',
  'stopping',
  'crashed'
])

export function isDevServiceRunning(service: DevServicesService): boolean {
  return RUNNING_STATES.has(service.state)
}

/** States the user cannot act on from here: someone else's copy, or not in this branch. */
export function isDevServiceActionable(service: DevServicesService): boolean {
  return service.state !== 'shared' && service.state !== 'absent' && service.state !== 'unknown'
}

/** "12 s", "3 min", "2 h" since a Unix time in seconds. */
export function formatDevServiceElapsed(sinceSeconds: number, nowMs: number = Date.now()): string {
  const seconds = Math.max(0, Math.floor(nowMs / 1000 - sinceSeconds))
  if (seconds < 60) {
    return `${seconds} s`
  }
  const minutes = Math.floor(seconds / 60)
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h`
}

export function runningDevServiceIds(status: DevServicesStatus): string[] {
  return status.services.filter(isDevServiceRunning).map((service) => service.id)
}
