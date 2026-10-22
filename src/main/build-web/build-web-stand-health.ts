import type { BuildWebMutationResult } from '../../shared/build-web-types'
import type { BuildWebImageBuild } from '../../shared/build-web-image-types'
import type {
  BuildWebStandGroup,
  BuildWebStandHealth,
  BuildWebStandHealthMap
} from '../../shared/build-web-stand-types'
import { standHealthOf } from '../../shared/build-web-stand-services'
import { mapWithConcurrency } from '../../shared/map-with-concurrency'
import { requireBuildWebCredential } from './build-web-connection'
import { recentBuildWebImageBuilds } from './build-web-images'
import { buildWebMutation, describeBuildWebError } from './build-web-request'
import { fetchBuildWebStandGroups, fetchBuildWebStandStatus } from './build-web-stands'

// Monitoring of the stands for the sidebar item and the stands table: every enabled stand the
// viewer has not hidden, read over SSH by the console once per directory, cached and shared.

const HEALTH_TTL_MS = 60_000
// Why: each read is an SSH session on the console; don't open one per stand at once.
const STATUS_CONCURRENCY = 4

type CachedHealth = { at: number; health: BuildWebStandHealth }

// Why per instance: hiding or showing one stand must not read every other stand again, and the
// stands over one directory (AP and SA of one box) are one compose project, read once.
let cache: { key: string; instances: Map<string, CachedHealth> } | null = null
const inflight = new Map<string, Promise<BuildWebStandHealthMap>>()

function instancesCache(key: string): Map<string, CachedHealth> {
  if (cache?.key !== key) {
    cache = { key, instances: new Map() }
  }
  return cache.instances
}

const instanceOf = (group: BuildWebStandGroup) => `${group.sshHost}:${group.dir}`

async function readHealth(
  key: string,
  hidden: ReadonlySet<string>,
  refresh: boolean
): Promise<BuildWebStandHealthMap> {
  const credential = requireBuildWebCredential(refresh ? {} : { background: true })
  const groups = (await fetchBuildWebStandGroups(credential)).filter(
    (g) => g.enabled && !hidden.has(g.key)
  )
  const byInstance = new Map<string, BuildWebStandGroup>()
  for (const group of groups) {
    if (!byInstance.has(instanceOf(group))) {
      byInstance.set(instanceOf(group), group)
    }
  }
  const instances = instancesCache(key)
  const now = Date.now()
  const stale = [...byInstance].filter(([instance]) => {
    const known = instances.get(instance)
    return refresh || !known || now - known.at >= HEALTH_TTL_MS
  })
  if (stale.length > 0) {
    // Why the catch: without access to Images only the compose drift counts as an update.
    const builds = await recentBuildWebImageBuilds().catch((): BuildWebImageBuild[] => [])
    await mapWithConcurrency(stale, STATUS_CONCURRENCY, async ([instance, group]) => {
      let health: BuildWebStandHealth
      try {
        const status = await fetchBuildWebStandStatus(credential, group.statusCardId)
        health = standHealthOf(instance, status, builds)
      } catch (error) {
        health = {
          instance,
          running: false,
          failing: 0,
          outdated: 0,
          updates: [],
          error: describeBuildWebError(error)
        }
      }
      instances.set(instance, { at: Date.now(), health })
    })
  }
  const out: BuildWebStandHealthMap = {}
  for (const group of groups) {
    const known = instances.get(instanceOf(group))
    if (known) {
      out[group.key] = { ...known.health, name: group.name }
    }
  }
  return out
}

/** Every enabled, not hidden stand's failing and outdated services; `refresh` reads past the cache. */
export function readBuildWebStandHealth(
  args: { refresh?: boolean; hidden?: string[] } = {}
): Promise<BuildWebMutationResult<BuildWebStandHealthMap>> {
  return buildWebMutation(async () => {
    const refresh = args.refresh === true
    const credential = requireBuildWebCredential(refresh ? {} : { background: true })
    const key = `${credential.baseUrl}#${credential.generation}`
    const hidden = new Set(args.hidden ?? [])
    const flight = `${key}|${refresh}|${[...hidden].sort().join('\n')}`
    const running = inflight.get(flight)
    if (running) {
      return running
    }
    const promise = readHealth(key, hidden, refresh).finally(() => inflight.delete(flight))
    inflight.set(flight, promise)
    return promise
  })
}

/** @internal - tests start from an empty cache. */
export function _resetBuildWebStandHealthCache(): void {
  cache = null
  inflight.clear()
}
