import type { HookCommandSourcePolicy } from './orca-yaml-hook-types'

export function resolveHookCommandSourcePolicy(
  policy: unknown,
  { hasLocalScript }: { hasLocalScript: boolean }
): HookCommandSourcePolicy {
  if (policy === 'local-only' || policy === 'run-both' || policy === 'shared-only') {
    return policy
  }

  if (policy === undefined && hasLocalScript) {
    return 'local-only'
  }

  return 'shared-only'
}

/** The services command has no local variant: under `local-only` the committed one is simply off. */
export function isServicesCommandDisabledByPolicy(policy: unknown): boolean {
  return resolveHookCommandSourcePolicy(policy, { hasLocalScript: false }) === 'local-only'
}
