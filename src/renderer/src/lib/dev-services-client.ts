import { callRuntimeRpc, runtimeEnvironmentSupportsCapability } from '@/runtime/runtime-rpc-client'
import { toRuntimeWorktreeSelector } from '@/runtime/runtime-worktree-selector'
import type { RuntimeClientTarget } from '../../../shared/runtime-client-target'
import { DEV_SERVICES_RUNTIME_CAPABILITY } from '../../../shared/dev-services-capability'
import {
  DEV_SERVICES_CLIENT_TIMEOUT_MARGIN_MS,
  DEV_SERVICES_RUN_CLIENT_TIMEOUT_MS,
  DEV_SERVICES_STATUS_TIMEOUT_MS,
  type DevServicesRunResponse,
  type DevServicesStatusResponse
} from '../../../shared/dev-services-contract'

/** This app's own runtime is this build; only a paired server can predate the methods. */
export async function devServicesSupportedBy(target: RuntimeClientTarget): Promise<boolean> {
  return target.kind === 'local'
    ? true
    : runtimeEnvironmentSupportsCapability(target.environmentId, DEV_SERVICES_RUNTIME_CAPABILITY)
}

export function fetchDevServicesStatus(
  target: RuntimeClientTarget,
  worktreeId: string,
  commandHash: string,
  signal?: AbortSignal
): Promise<DevServicesStatusResponse> {
  return callRuntimeRpc<DevServicesStatusResponse>(
    target,
    'devServices.status',
    { worktree: toRuntimeWorktreeSelector(worktreeId), commandHash },
    { timeoutMs: DEV_SERVICES_STATUS_TIMEOUT_MS + DEV_SERVICES_CLIENT_TIMEOUT_MARGIN_MS, signal }
  )
}

export function runDevServicesAction(
  target: RuntimeClientTarget,
  worktreeId: string,
  commandHash: string,
  verb: string,
  args: readonly string[]
): Promise<DevServicesRunResponse> {
  return callRuntimeRpc<DevServicesRunResponse>(
    target,
    'devServices.run',
    { worktree: toRuntimeWorktreeSelector(worktreeId), commandHash, verb, args: [...args] },
    { timeoutMs: DEV_SERVICES_RUN_CLIENT_TIMEOUT_MS }
  )
}
