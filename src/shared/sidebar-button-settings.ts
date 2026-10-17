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
}
