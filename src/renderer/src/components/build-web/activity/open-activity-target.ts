import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import type { BuildWebRun } from '../../../../../shared/build-web-run-types'
import { callBuildWeb } from '../build-web-client'
import { useBuildWebStore, type BuildWebCardTab } from '../build-web-store'
import { findBuildWebTaskByKey } from '../open-task-by-key'
import { withoutPageRecording } from '../page-history/page-history-store'
import type { PageTarget } from './activity-targets'
import { findFailedTrainWindow, findRunTrainWindow, type TrainWindow } from './train-window-lookup'

/** The host that holds the build-web token, the key the Issues store tags its answers with, and its console. */
export type ActivityHost = { target: RuntimeClientTarget; contextKey: string; baseUrl: string }

// The build statuses the console raises a failure for.
const FAILED_BUILD = new Set(['FAILURE', 'UNSTABLE', 'trigger-failed', 'poll-failed'])

async function knowHost(host: ActivityHost): Promise<void> {
  const store = useBuildWebStore.getState()
  // Why: the first status of a host clears what is open, so it must land before a page opens.
  if (store.contextKey !== host.contextKey) {
    const status = await callBuildWeb(host.target, 'status').catch(() => null)
    if (status) {
      store.setStatus(host.contextKey, status)
    }
  }
}

async function openCard(host: ActivityHost, issueId: string, tab: BuildWebCardTab): Promise<void> {
  await knowHost(host)
  // Why the page first, unrecorded: the history gets the card, not an Issues list nobody saw.
  withoutPageRecording(() => useAppStore.getState().openBuildWebPage())
  if (tab === 'overview') {
    useBuildWebStore.getState().openIssue(issueId)
  } else {
    useBuildWebStore.getState().openIssue(issueId, true, tab)
  }
}

/** The Trains page on the window's train, with the window open; just the page without one. */
async function openTrainWindow(host: ActivityHost, found: TrainWindow | null): Promise<void> {
  await knowHost(host)
  useBuildWebStore
    .getState()
    .setFocus(found ? { kind: 'train', trainId: found.train.id, run: found.run } : null)
  useAppStore.getState().openBuildWebTrainsPage()
}

/** The image a run's failure is about: its failed build's, else its only one. */
function failedImageOf(run: BuildWebRun): string | null {
  const build = run.builds.find((b) => FAILED_BUILD.has(b.status)) ?? run.builds[0]
  return build?.image ?? null
}

/**
 * A run outside a task's card: a train window's images on the Trains page, a build started from
 * the Images page on that image's history. Null when it is neither.
 */
async function openRunInOrca(host: ActivityHost, run: BuildWebRun): Promise<boolean> {
  const trainWindow = await findRunTrainWindow(host.target, run.id).catch(() => null)
  if (trainWindow) {
    await openTrainWindow(host, trainWindow)
    return true
  }
  const image = failedImageOf(run)
  if (!image) {
    return false
  }
  await knowHost(host)
  useBuildWebStore.getState().setFocus({ kind: 'image', image })
  useAppStore.getState().openBuildWebImagesPage()
  return true
}

/** Show what a bell or task row is about: its task's card in Orca, else the console's page. */
export async function openActivityTarget(where: PageTarget, host: ActivityHost): Promise<void> {
  switch (where.kind) {
    case 'issue':
      return openCard(host, where.issueId, where.tab)
    case 'console':
      return window.api.shell.openUrl(`${host.baseUrl}${where.path}`)
    case 'test-run':
      await knowHost(host)
      useBuildWebStore.getState().setFocus({ kind: 'test-run', runId: where.runId })
      return useAppStore.getState().openBuildWebTestingPage()
    case 'train': {
      const found = where.trainName
        ? await findFailedTrainWindow(host.target, where.trainName, where.at).catch(() => null)
        : null
      return openTrainWindow(host, found)
    }
    case 'run': {
      // Why a read: a task row names its run only; the run names the task it was built for.
      const run = await callBuildWeb(host.target, 'getRun', { runId: where.runId }).catch(
        () => null
      )
      if (run?.issue_id) {
        return openCard(host, run.issue_id, where.tab)
      }
      // Why the number: a run made for a task by its number alone carries no task id.
      const task = run?.ticket
        ? await findBuildWebTaskByKey(host.target, run.ticket).catch(() => undefined)
        : undefined
      if (task) {
        return openCard(host, task.id, where.tab)
      }
      if (run && where.tab !== 'guide' && (await openRunInOrca(host, run))) {
        return
      }
      if (where.tab === 'guide') {
        return window.api.shell.openUrl(
          `${host.baseUrl}/runs/${encodeURIComponent(where.runId)}/guide`
        )
      }
      // Why no browser: a run Orca cannot place is said so, not handed to the console's site.
      toast.error(
        translate('buildWeb.activity.runNotFound', 'Orca could not open build run {{id}}', {
          id: where.runId
        })
      )
    }
  }
}
