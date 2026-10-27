import { createContext, useContext } from 'react'
import type { BuildWebIssueDetail } from '../../../src/shared/build-web-types'
import type { BuildWebRun, BuildWebTestingStatus } from '../../../src/shared/build-web-run-types'

/** The card's tabs, in the desktop's order. */
export const BUILD_WEB_CARD_TABS = [
  'overview',
  'plan',
  'mockups',
  'build',
  'guide',
  'commits',
  'subtasks'
] as const
export type BuildWebCardTab = (typeof BUILD_WEB_CARD_TABS)[number]

/** What the card hands each of its tabs. */
export type BuildWebIssueTabProps = {
  detail: BuildWebIssueDetail
  reloadDetail: () => void
  /** `undefined` while it loads, null when the task has no build. */
  run: BuildWebRun | null | undefined
  runError: string | null
  setRun: (run: BuildWebRun | null) => void
  reloadRun: () => void
  /** The owner may push and save guides. */
  canWrite: boolean
  /** Where the build is headed; before the first build, where it will be. */
  testing: BuildWebTestingStatus
  setTesting: (next: BuildWebTestingStatus) => void
  openTab: (tab: BuildWebCardTab) => void
}

// Why: an opened tab stays mounted while hidden, and must not keep polling the console then.
export const CardTabActiveContext = createContext(true)

export function useCardTabActive(): boolean {
  return useContext(CardTabActiveContext)
}
