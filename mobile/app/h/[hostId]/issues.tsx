import { useLocalSearchParams } from 'expo-router'
import { MobileWebShellScreen } from '../../../src/mobile-web-shell/MobileWebShellScreen'
import { shellScreenRoute } from '../../../src/mobile-web-shell/shell-screen-route'
import { PageRouteUnavailableScreen } from '../../../src/mobile-web-shell/PageRouteUnavailableScreen'
import { firstParam } from '../../../src/navigation/route-param-reader'

// build-web's Issues: the page renders it inside the shell, as the Tasks route does.
export default function MobileIssuesRoute() {
  // Use firstParam: repeated query keys are arrays and must not form a comma-joined host segment.
  const params = useLocalSearchParams<{ hostId?: string | string[] }>()
  const hostId = firstParam(params.hostId)
  const route = hostId
    ? shellScreenRoute({ pathname: `/h/${encodeURIComponent(hostId)}/issues` })
    : null
  if (route === null) {
    return <PageRouteUnavailableScreen hostId={hostId} />
  }
  return (
    <MobileWebShellScreen
      // Remount on host change to discard the old session’s grants.
      key={hostId}
      hostId={hostId}
      route={route}
    />
  )
}
