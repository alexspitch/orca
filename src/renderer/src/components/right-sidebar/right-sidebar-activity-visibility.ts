import type { ActivityBarItem } from './activity-bar-buttons'

type RightSidebarActivityVisibilityState = {
  isFolder: boolean
  isFolderWorkspace: boolean
  /** The workspace runs on an SSH host, reached directly or through its managed server. */
  hasSshHost: boolean
  /** orca.yaml names a services command and the workspace's host serves it. */
  hasDevServices?: boolean
}

export function getVisibleRightSidebarActivityItems(
  items: ActivityBarItem[],
  {
    isFolder,
    isFolderWorkspace,
    hasSshHost,
    hasDevServices = false
  }: RightSidebarActivityVisibilityState
): ActivityBarItem[] {
  return items.filter(
    (item) =>
      (!item.gitOnly || !isFolder) &&
      (!item.folderOnly || isFolderWorkspace) &&
      (!item.sshOnly || hasSshHost) &&
      (!item.servicesOnly || hasDevServices)
  )
}
