import { withWorkspaceRoute } from '../../../../../src/navigation/workspace-route'
import { useLocalSearchParams } from 'expo-router'
import { MobileFilePreviewScreen } from '../../../../../src/files/MobileFilePreviewScreen'
import { normalizeMobileFilePreviewRouteParams } from '../../../../../src/files/mobile-file-preview-route'
import { MobileTerminalFolderScreen } from '../../../../../src/files/MobileTerminalFolderScreen'

// Render screen directly: native sibling imports a shell module that throws in browsers, and manifest imports every route.
export default withWorkspaceRoute(function MobileFilePreviewRoute() {
  const params = useLocalSearchParams<{
    hostId?: string | string[]
    worktreeId?: string | string[]
    relativePath?: string | string[]
    source?: string | string[]
    absolutePath?: string | string[]
    grantId?: string | string[]
    terminal?: string | string[]
    pathText?: string | string[]
    cwd?: string | string[]
    nativeChatTab?: string | string[]
    nativeChatSession?: string | string[]
    line?: string | string[]
    column?: string | string[]
    name?: string | string[]
    worktreeName?: string | string[]
  }>()
  const route = normalizeMobileFilePreviewRouteParams(params)
  const folder = route.ok && route.params.source === 'terminalFolder' ? route.params : null
  // Why here: a terminal folder lists its files; each opens back on this route as a terminal artifact.
  if (folder?.absolutePath && folder.grantId) {
    return (
      <MobileTerminalFolderScreen
        params={{ ...folder, absolutePath: folder.absolutePath, grantId: folder.grantId }}
      />
    )
  }
  return <MobileFilePreviewScreen route={route} />
})
