import type {
  BuildWebStandHealth,
  BuildWebStandHealthMap,
  BuildWebStandUpdate
} from '../../../../../shared/build-web-stand-types'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import { callBuildWeb } from '../build-web-client'

/** Every enabled stand's health but the hidden; throws what the console refused, as the badge expects. */
export async function readStandHealth(
  target: RuntimeClientTarget,
  args: { refresh?: boolean; hidden: string[] }
): Promise<BuildWebStandHealthMap> {
  const result = await callBuildWeb(target, 'standHealth', {
    ...(args.refresh ? { refresh: true } : {}),
    ...(args.hidden.length ? { hidden: args.hidden } : {})
  })
  if (!result.ok) {
    throw new Error(result.error)
  }
  return result.value
}

export type StandUpdatesOf = { instance: string; stands: string; updates: BuildWebStandUpdate[] }

/**
 * The running stands' failing and outdated services for the sidebar item: stands over one
 * directory are one compose project, so their services count once.
 */
export function standHealthTotals(health: BuildWebStandHealthMap | null): {
  failing: number
  outdated: number
  updates: StandUpdatesOf[]
} {
  const byInstance = new Map<string, { health: BuildWebStandHealth; names: string[] }>()
  for (const [key, h] of Object.entries(health ?? {})) {
    if (!h.running) {
      continue
    }
    const instance = h.instance ?? key
    const seen = byInstance.get(instance)
    if (seen) {
      seen.names.push(h.name ?? '')
    } else {
      byInstance.set(instance, { health: h, names: [h.name ?? ''] })
    }
  }
  const running = [...byInstance.values()]
  return {
    failing: running.reduce((sum, r) => sum + r.health.failing, 0),
    outdated: running.reduce((sum, r) => sum + r.health.outdated, 0),
    updates: [...byInstance]
      .filter(([, r]) => (r.health.updates?.length ?? 0) > 0)
      .map(([instance, r]) => ({
        instance,
        stands: r.names.filter(Boolean).join(' · '),
        updates: r.health.updates ?? []
      }))
  }
}
