// Per-viewer conveniences of the Testing page, in localStorage: lost storage just means defaults.

export const TESTING_TABS = ['watch', 'history'] as const
export type TestingTab = (typeof TESTING_TABS)[number]

export const TEST_RUN_KINDS = ['all', 'nightly', 'manual'] as const
export type TestRunKind = (typeof TEST_RUN_KINDS)[number]

export const TEST_RUN_TABS = ['changes', 'tests'] as const
export type TestRunTab = (typeof TEST_RUN_TABS)[number]

type TestingViewPrefs = {
  tab: TestingTab
  /** The history list's filter. */
  kind: TestRunKind
  /** A run's table: what changed since the run before, or every test of it. */
  runTab: TestRunTab
}

const STORAGE_KEY = 'orca.buildWeb.testingPrefs'
const DEFAULTS: TestingViewPrefs = { tab: 'watch', kind: 'all', runTab: 'changes' }

function prefsOf(raw: unknown): TestingViewPrefs {
  if (!raw || typeof raw !== 'object') {
    return DEFAULTS
  }
  const v = Object.fromEntries(Object.entries(raw))
  return {
    tab: TESTING_TABS.find((t) => t === v.tab) ?? DEFAULTS.tab,
    kind: TEST_RUN_KINDS.find((k) => k === v.kind) ?? DEFAULTS.kind,
    runTab: TEST_RUN_TABS.find((t) => t === v.runTab) ?? DEFAULTS.runTab
  }
}

export function readTestingViewPrefs(): TestingViewPrefs {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? prefsOf(JSON.parse(raw)) : DEFAULTS
  } catch {
    return DEFAULTS
  }
}

export function writeTestingViewPrefs(patch: Partial<TestingViewPrefs>): void {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...readTestingViewPrefs(), ...patch })
    )
  } catch {
    // Storage may be disabled; the preference just won't survive this session.
  }
}
