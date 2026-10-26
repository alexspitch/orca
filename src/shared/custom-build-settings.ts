import type { GitLogSettings } from './git-log-settings'
import type { GlobalSettingsBase as UpstreamGlobalSettingsBase } from './global-settings-base'
import type { SidebarButtonSettings } from './sidebar-button-settings'

/** Settings only the custom build has. */
export type CustomBuildSettings = SidebarButtonSettings &
  GitLogSettings & {
    /** The Explorer's file and folder icons: Orca's own, or the Material Icon Theme's. */
    fileIconTheme?: 'orca' | 'material'
  }

// Why through the base: GlobalSettings gains these without touching upstream's field list.
export type GlobalSettingsBase = UpstreamGlobalSettingsBase & CustomBuildSettings
