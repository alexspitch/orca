import type { BuildWebStandHealthMap } from '../../../../../shared/build-web-stand-types'
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

/** The running stands' failing and outdated services, summed for the sidebar item. */
export function standHealthTotals(health: BuildWebStandHealthMap | null): {
  failing: number
  outdated: number
} {
  const running = Object.values(health ?? {}).filter((h) => h.running)
  return {
    failing: running.reduce((sum, h) => sum + h.failing, 0),
    outdated: running.reduce((sum, h) => sum + h.outdated, 0)
  }
}
