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
  /** The «Testing» shortcut to build-web's watch; unset, it follows «Issues». */
  showBuildWebTestingButton?: boolean
  /** The «Recaps» shortcut to build-web's automation reports; unset, it follows «Issues». */
  showBuildWebRecapsButton?: boolean
  /** The «Stands» group of build-web's stands; unset, it follows «Issues». */
  showBuildWebStandsButton?: boolean
  /** build-web's bell and task counter in the titlebar; unset, they follow «Issues». */
  showBuildWebActivity?: boolean
}

/** Trains came after Issues: someone already on build-web sees it without a trip to Settings. */
export function showsBuildWebTrains(settings: SidebarButtonSettings | null | undefined): boolean {
  return settings?.showBuildWebTrainsButton ?? settings?.showBuildWebButton === true
}

/** Testing came after Issues as well, and is shown the same way. */
export function showsBuildWebTesting(settings: SidebarButtonSettings | null | undefined): boolean {
  return settings?.showBuildWebTestingButton ?? settings?.showBuildWebButton === true
}

/** Recaps came after Issues too, and is shown the same way. */
export function showsBuildWebRecaps(settings: SidebarButtonSettings | null | undefined): boolean {
  return settings?.showBuildWebRecapsButton ?? settings?.showBuildWebButton === true
}

/** Stands came after Issues too, and is shown the same way. */
export function showsBuildWebStands(settings: SidebarButtonSettings | null | undefined): boolean {
  return settings?.showBuildWebStandsButton ?? settings?.showBuildWebButton === true
}

/** The titlebar's bell and task counter came after Issues too, and are shown the same way. */
export function showsBuildWebActivity(settings: SidebarButtonSettings | null | undefined): boolean {
  return settings?.showBuildWebActivity ?? settings?.showBuildWebButton === true
}
