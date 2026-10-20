import { create } from 'zustand'
import { checkRuntimeHooks } from '@/runtime/runtime-hooks-client'
import { devServicesSupportedBy } from '@/lib/dev-services-client'
import { getServicesTrustContent } from '@/lib/ensure-hooks-confirmed'
import type { ExecutionHostId } from '../../../shared/execution-host'
import type { RuntimeClientTarget } from '../../../shared/runtime-client-target'

/** What a repo's orca.yaml says about services, as its host last reported. */
type RepoServicesEntry = {
  command: string | null
  checkedAt: number
}

type DevServicesAvailabilityState = {
  byRepoKey: Record<string, RepoServicesEntry>
  setEntry: (key: string, entry: RepoServicesEntry) => void
}

// Why a minute: orca.yaml rarely changes; a stale answer only delays the tab, and the host re-checks
// the command's hash on every call anyway.
export const DEV_SERVICES_AVAILABILITY_RECHECK_MS = 60_000

export const useDevServicesAvailabilityStore = create<DevServicesAvailabilityState>()((set) => ({
  byRepoKey: {},
  setEntry: (key, entry) => set((state) => ({ byRepoKey: { ...state.byRepoKey, [key]: entry } }))
}))

export function devServicesRepoKey(hostId: ExecutionHostId, repoId: string): string {
  return `${hostId}\u0000${repoId}`
}

const inFlight = new Map<string, Promise<void>>()

export function refreshDevServicesAvailability(args: {
  hostId: ExecutionHostId
  repoId: string
  target: RuntimeClientTarget
}): Promise<void> {
  const key = devServicesRepoKey(args.hostId, args.repoId)
  const running = inFlight.get(key)
  if (running) {
    return running
  }
  const run = (async () => {
    const previous = useDevServicesAvailabilityStore.getState().byRepoKey[key]
    let command: string | null
    try {
      if (!(await devServicesSupportedBy(args.target))) {
        command = null
      } else {
        const result = await checkRuntimeHooks(args.hostId, args.repoId)
        command = result.status === 'error' ? null : getServicesTrustContent(result.hooks) || null
      }
    } catch {
      // Why keep the last answer: one dropped call must not make the tab blink away.
      command = previous?.command ?? null
    }
    useDevServicesAvailabilityStore.getState().setEntry(key, { command, checkedAt: Date.now() })
  })().finally(() => {
    inFlight.delete(key)
  })
  inFlight.set(key, run)
  return run
}
