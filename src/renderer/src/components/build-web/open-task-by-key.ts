import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { defaultScopeHost } from '@/lib/default-creation-host'
import { getProviderRuntimeContextKey } from '@/lib/provider-runtime-context'
import { translate } from '@/i18n/i18n'
import type { BuildWebIssueRow } from '../../../../shared/build-web-types'
import type { JiraIssue } from '../../../../shared/jira-types'
import type { RuntimeClientTarget } from '../../../../shared/runtime-client-target'
import { callBuildWeb } from './build-web-client'
import { useBuildWebStore } from './build-web-store'
import { labelIssuePage, withoutPageRecording } from './page-history/page-history-store'
import { armLinkReturn } from '@/components/link-return/link-return-arm'

/** The task a number names: build-web's own number, or the Jira number of a task linked to Jira. */
export async function findBuildWebTaskByKey(
  target: RuntimeClientTarget,
  key: string
): Promise<BuildWebIssueRow | undefined> {
  // Why the families: a subtask's number is found under its parent.
  const page = await callBuildWeb(target, 'listIssues', {
    view: 'all',
    q: key,
    limit: 20,
    offset: 0,
    tree: true
  })
  return page.issues.find((row) => row.key === key || row.jira_key === key)
}

/** The card on the whole page, which keeps it as a tab of Issues. */
export function showBuildWebTaskCard(task: Pick<BuildWebIssueRow, 'id' | 'key' | 'title'>): void {
  // Why the page unrecorded: the history gets the card, not an Issues list nobody saw.
  withoutPageRecording(() => useAppStore.getState().openBuildWebPage())
  useBuildWebStore.getState().openIssue(task.id, true)
  labelIssuePage(task.id, `${task.key} · ${task.title}`)
}

type TaskHost = { target: RuntimeClientTarget; contextKey: string }

type KnownTask =
  | { source: 'build-web'; task: BuildWebIssueRow }
  | { source: 'jira'; issue: JiraIssue }
  | null

// Why a cache: hovering a number reads its title, and a click right after must not read it again.
const KNOWN_TTL_MS = 5 * 60_000
const known = new Map<string, { at: number; promise: Promise<KnownTask> }>()

function taskHost(): TaskHost {
  const host = {
    activeRuntimeEnvironmentId: useAppStore.getState().settings?.activeRuntimeEnvironmentId ?? null
  }
  return { target: defaultScopeHost(host), contextKey: getProviderRuntimeContextKey(host) }
}

async function lookUp(host: TaskHost, key: string): Promise<KnownTask> {
  const task = await findBuildWebTaskByKey(host.target, key).catch(() => undefined)
  if (task) {
    return { source: 'build-web', task }
  }
  const issue = await useAppStore
    .getState()
    .fetchJiraIssue(key)
    .catch(() => null)
  return issue ? { source: 'jira', issue } : null
}

/** What a task number names in build-web, else in Jira; null when neither knows it. */
function resolveTaskByKey(host: TaskHost, key: string): Promise<KnownTask> {
  const cacheKey = `${host.contextKey}|${key}`
  const cached = known.get(cacheKey)
  if (cached && Date.now() - cached.at < KNOWN_TTL_MS) {
    return cached.promise
  }
  const promise = lookUp(host, key)
  known.set(cacheKey, { at: Date.now(), promise })
  // Why: a number nobody knows yet (a task being created) is asked again on the next hover.
  void promise.then((found) => {
    if (!found && known.get(cacheKey)?.promise === promise) {
      known.delete(cacheKey)
    }
  })
  return promise
}

/** The task's title for a hover over its number; null when neither build-web nor Jira knows it. */
export async function taskTitleByKey(key: string): Promise<string | null> {
  const found = await resolveTaskByKey(taskHost(), key)
  if (!found) {
    return null
  }
  return found.source === 'build-web' ? found.task.title : found.issue.title
}

/**
 * A task number clicked in a terminal: its build-web card as a tab of Issues, else the Jira issue
 * on the Tasks page, else a note that neither knows it.
 */
export async function openTaskByKey(key: string): Promise<void> {
  armLinkReturn()
  const host = taskHost()
  const found = await resolveTaskByKey(host, key)
  if (found?.source === 'build-web') {
    const store = useBuildWebStore.getState()
    // Why: the first status of a host clears the open card, so it must land before the card opens.
    if (store.contextKey !== host.contextKey) {
      const status = await callBuildWeb(host.target, 'status').catch(() => null)
      if (status) {
        store.setStatus(host.contextKey, status)
      }
    }
    showBuildWebTaskCard(found.task)
    return
  }
  if (found?.source === 'jira') {
    useAppStore.getState().openTaskPage({ openJiraIssue: found.issue })
    return
  }
  toast.error(
    translate('buildWeb.openTaskByKey.missing', 'Neither build-web nor Jira has a task {{key}}.', {
      key
    })
  )
}
