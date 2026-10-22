import {
  BUILD_WEB_STAND_LOG_TAILS,
  type BuildWebStandLogTail
} from '../../../../../shared/build-web-stand-types'

// Per-viewer conveniences of the Stands page, in localStorage: lost storage just means defaults.

export type StandTab = 'services' | 'users'

type StandViewPrefs = {
  /** The stand last opened, by its group key. */
  selectedKey: string | null
  tab: StandTab
  logTail: BuildWebStandLogTail
  /** Stands taken off the list, by group key; they are not monitored either. */
  hiddenKeys: string[]
  /** The list shows the hidden stands too, so one can be shown again. */
  showHidden: boolean
}

const STORAGE_KEY = 'orca.buildWeb.standPrefs'
const DEFAULTS: StandViewPrefs = {
  selectedKey: null,
  tab: 'services',
  logTail: 2000,
  hiddenKeys: [],
  showHidden: false
}

function prefsOf(raw: unknown): StandViewPrefs {
  if (!raw || typeof raw !== 'object') {
    return DEFAULTS
  }
  const v = Object.fromEntries(Object.entries(raw))
  return {
    selectedKey: typeof v.selectedKey === 'string' ? v.selectedKey : null,
    tab: v.tab === 'users' ? 'users' : 'services',
    logTail: BUILD_WEB_STAND_LOG_TAILS.find((n) => n === v.logTail) ?? DEFAULTS.logTail,
    hiddenKeys: Array.isArray(v.hiddenKeys)
      ? v.hiddenKeys.filter((k): k is string => typeof k === 'string')
      : [],
    showHidden: v.showHidden === true
  }
}

export function readStandViewPrefs(): StandViewPrefs {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? prefsOf(JSON.parse(raw)) : DEFAULTS
  } catch {
    return DEFAULTS
  }
}

export function writeStandViewPrefs(patch: Partial<StandViewPrefs>): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readStandViewPrefs(), ...patch }))
  } catch {
    // Storage may be disabled; the preference just won't survive this session.
  }
}
