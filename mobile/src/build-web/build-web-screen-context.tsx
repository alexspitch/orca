import { createContext, useContext } from 'react'
import type {
  BuildWebConnectionStatus,
  BuildWebIssueRow
} from '../../../src/shared/build-web-types'
import type { RpcClient } from '../transport/rpc-client'
import type { BuildWebCardTab } from './build-web-card-tabs'
import type { BuildWebArgs, BuildWebMethod, BuildWebResult } from './build-web-operations'

export type BuildWebNoticeTone = 'info' | 'success' | 'error'

/** What every part of the Issues screen shares: the host, its build-web account and the page's moves. */
export type BuildWebScreen = {
  hostId: string
  client: RpcClient
  hostCapabilities: readonly string[]
  /** Always connected here: the screen shows the connect form until it is. */
  status: BuildWebConnectionStatus
  setStatus: (status: BuildWebConnectionStatus) => void
  call: <M extends BuildWebMethod>(
    method: M,
    ...params: BuildWebArgs<M>
  ) => Promise<BuildWebResult<M>>
  /** Opens a task's card on top of whatever is shown; Back returns to it. */
  openIssue: (id: string, tab?: BuildWebCardTab) => void
  closeIssue: () => void
  takeToWork: (issues: BuildWebIssueRow[]) => void
  /** The list under the cards, kept in step with what a card changed. */
  listSync: BuildWebListSync
  /** The list hands over its own handlers once mounted. */
  registerList: (handlers: Partial<BuildWebListSync>) => void
  /** The desktop's toasts: a short line at the bottom of the screen. */
  notify: (message: string, tone?: BuildWebNoticeTone) => void
}

export type BuildWebListSync = {
  patch: (id: string, patch: Partial<BuildWebIssueRow>) => void
  /** Out of the live list: archived, or no longer matching. */
  drop: (id: string) => void
  reload: () => void
}

export const BuildWebScreenContext = createContext<BuildWebScreen | null>(null)

export function useBuildWebScreen(): BuildWebScreen {
  const screen = useContext(BuildWebScreenContext)
  if (!screen) {
    throw new Error('useBuildWebScreen must be used inside the Issues screen')
  }
  return screen
}
