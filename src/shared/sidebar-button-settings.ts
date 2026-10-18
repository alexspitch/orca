/** Sidebar shortcuts a person may hide; each page stays reachable from Settings. */
export type SidebarButtonSettings = {
  /** Only toggles the sidebar shortcut; Artifacts stay reachable from Settings. */
  showArtifactsButton?: boolean
  /** Only toggles the sidebar shortcut; Skills stay reachable from Settings. */
  showSkillsButton?: boolean
  /** Only toggles the sidebar shortcut; Orca Mobile stays reachable from Settings. */
  showMobileButton?: boolean
  /** The «Issues» shortcut to build-web's tasks; Settings → Integrations shows it again. */
  showBuildWebButton?: boolean
  /** The «Images» shortcut to build-web's images, with the count of builds running now. */
  showBuildWebImagesButton?: boolean
  /** The «Trains» shortcut to build-web's build trains; unset, it follows «Issues». */
  showBuildWebTrainsButton?: boolean
}

/** Trains came after Issues: someone already on build-web sees it without a trip to Settings. */
export function showsBuildWebTrains(settings: SidebarButtonSettings | null | undefined): boolean {
  return settings?.showBuildWebTrainsButton ?? settings?.showBuildWebButton === true
}
