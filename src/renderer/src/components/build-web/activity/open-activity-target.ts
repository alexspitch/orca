import { useAppStore } from '@/store'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import { callBuildWeb } from '../build-web-client'
import { useBuildWebStore, type BuildWebCardTab } from '../build-web-store'
import { withoutPageRecording } from '../page-history/page-history-store'
import type { PageTarget } from './activity-targets'

/** The host that holds the build-web token, the key the Issues store tags its answers with, and its console. */
export type ActivityHost = { target: RuntimeClientTarget; contextKey: string; baseUrl: string }

async function openCard(host: ActivityHost, issueId: string, tab: BuildWebCardTab): Promise<void> {
  const store = useBuildWebStore.getState()
  // Why: the first status of a host clears the open card, so it must land before the card opens.
  if (store.contextKey !== host.contextKey) {
    const status = await callBuildWeb(host.target, 'status').catch(() => null)
    if (status) {
      store.setStatus(host.contextKey, status)
    }
  }
  // Why the page first, unrecorded: the history gets the card, not an Issues list nobody saw.
  withoutPageRecording(() => useAppStore.getState().openBuildWebPage())
  if (tab === 'overview') {
    useBuildWebStore.getState().openIssue(issueId)
  } else {
    useBuildWebStore.getState().openIssue(issueId, true, tab)
  }
}

/** Show what a bell or task row is about: its task's card in Orca, else the console's page. */
export async function openActivityTarget(where: PageTarget, host: ActivityHost): Promise<void> {
  switch (where.kind) {
    case 'issue':
      return openCard(host, where.issueId, where.tab)
    case 'console':
      return window.api.shell.openUrl(`${host.baseUrl}${where.path}`)
    case 'run': {
      // Why a read: a task row names its run only; the run names the task it was built for.
      const run = await callBuildWeb(host.target, 'getRun', { runId: where.runId }).catch(
        () => null
      )
      if (run?.issue_id) {
        return openCard(host, run.issue_id, where.tab)
      }
      const page = where.tab === 'guide' ? '/guide' : ''
      return window.api.shell.openUrl(
        `${host.baseUrl}/runs/${encodeURIComponent(where.runId)}${page}`
      )
    }
  }
}
