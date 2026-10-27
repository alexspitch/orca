import { useCallback } from 'react'
import { useOpenHostStackRoute } from '../navigation/use-open-host-stack-route'

/** Opens a host's build-web Issues, which take the standard Tasks' place in this build. */
export function useOpenMobileIssues(): (hostId: string) => void {
  const openHostStackRoute = useOpenHostStackRoute()
  return useCallback(
    (hostId) => openHostStackRoute(hostId, { name: '[hostId]/issues', params: { hostId } }),
    [openHostStackRoute]
  )
}
