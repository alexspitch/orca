import { translateMain } from '../i18n/main-i18n'

type OpenInWindow = (window?: Electron.BaseWindow | null) => void

/** Help's entries that open a renderer surface in the window the menu was used from. */
export function createAppMenuHelpItems(open: {
  featureTour: OpenInWindow
  setupGuide: OpenInWindow
  crashReport: OpenInWindow
  changelog: OpenInWindow
}): Record<keyof typeof open, Electron.MenuItemConstructorOptions> {
  const item = (label: string, onOpen: OpenInWindow): Electron.MenuItemConstructorOptions => ({
    label,
    click: (_menuItem, window) => onOpen(window)
  })
  return {
    featureTour: item(translateMain('menu.exploreOrca', 'Explore Orca'), open.featureTour),
    setupGuide: item(
      translateMain('menu.gettingStarted', 'Getting Started with Orca'),
      open.setupGuide
    ),
    crashReport: item(translateMain('menu.reportCrash', 'Report Crash...'), open.crashReport),
    changelog: item(translateMain('menu.changelog', 'Changelog'), open.changelog)
  }
}
