import { useMemo } from 'react'
import { useAppStore } from '@/store'
import { toRuntimeExecutionHostId } from '../../../shared/execution-host'
import { buildExecutionHostRegistry } from '../../../shared/execution-host-registry'
import { getHostDisplayLabelOverrides } from '../../../shared/host-setting-overrides'
import { pickerExecutionHosts } from '../../../shared/managed-orcad-execution-host'
import { isListedRemoteServer } from '../../../shared/runtime-environments'
import {
  isConnectedRuntimeHostState,
  runtimeHostConnectionStateForEntry
} from '@/runtime/runtime-host-connection-state'

export type ConnectedRuntimeServer = { id: string; label: string }

/** The connected paired servers, named and deduplicated as SshStatusSegment's server rows are. */
export function useConnectedRuntimeServers(): readonly ConnectedRuntimeServer[] {
  const settings = useAppStore((s) => s.settings)
  const sshTargetLabels = useAppStore((s) => s.sshTargetLabels)
  const sshConnectionStates = useAppStore((s) => s.sshConnectionStates)
  const runtimeEnvironments = useAppStore((s) => s.runtimeEnvironments)
  const runtimeStatusByEnvironmentId = useAppStore((s) => s.runtimeStatusByEnvironmentId)

  const servers = useMemo(() => {
    const listed = runtimeEnvironments.filter(isListedRemoteServer)
    // Why the registry: a managed server and its SSH host are one machine, shown once.
    const visibleHosts = new Map(
      pickerExecutionHosts(
        buildExecutionHostRegistry({
          repos: [],
          settings,
          hostSource: 'configured-only',
          sshTargetLabels,
          sshConnectionStates,
          runtimeEnvironments: listed,
          runtimeStatusByEnvironmentId,
          hostLabelOverrides: getHostDisplayLabelOverrides(settings)
        })
      ).map((host) => [host.id, host])
    )
    return listed.flatMap((environment) => {
      const host = visibleHosts.get(toRuntimeExecutionHostId(environment.id))
      const state = runtimeHostConnectionStateForEntry(
        runtimeStatusByEnvironmentId.get(environment.id)
      )
      return host && isConnectedRuntimeHostState(state)
        ? [{ id: environment.id, label: host.label || environment.name || environment.id }]
        : []
    })
  }, [
    runtimeEnvironments,
    runtimeStatusByEnvironmentId,
    settings,
    sshConnectionStates,
    sshTargetLabels
  ])

  return servers
}
