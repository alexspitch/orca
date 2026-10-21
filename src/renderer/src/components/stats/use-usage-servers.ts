import { useEffect } from 'react'
import { useAppStore } from '../../store'
import { useConnectedRuntimeServers } from '@/hooks/use-connected-runtime-servers'
import type { UsageServer } from '@/store/slices/usage-hosts/usage-host-types'

/** The connected paired servers, kept in the store for the usage slices to read. */
export function useUsageServers(): readonly UsageServer[] {
  const servers = useConnectedRuntimeServers()
  const setUsageServers = useAppStore((s) => s.setUsageServers)
  useEffect(() => {
    setUsageServers(servers)
  }, [servers, setUsageServers])
  return servers
}
