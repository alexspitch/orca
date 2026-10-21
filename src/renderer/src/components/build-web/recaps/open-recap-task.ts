import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import type { BuildWebRecap } from '../../../../../shared/build-web-recap-types'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import { callBuildWeb } from '../build-web-client'
import { useBuildWebStore } from '../build-web-store'
import {
  labelIssuePage,
  recordPage,
  withoutPageRecording
} from '../page-history/page-history-store'

/**
 * A task number clicked in a report: its card on the whole page, with the report recorded as the
 * page left, so Back returns to it. The number is build-web's own or the task's Jira number.
 */
export async function openRecapTask(
  target: RuntimeClientTarget,
  recap: BuildWebRecap,
  key: string
): Promise<void> {
  recordPage({ kind: 'recap', recap })
  let found: { id: string; key: string; title: string } | undefined
  try {
    // Why the families: a subtask's number is found under its parent.
    const page = await callBuildWeb(target, 'listIssues', {
      view: 'all',
      q: key,
      limit: 20,
      offset: 0,
      tree: true
    })
    found = page.issues.find((row) => row.key === key || row.jira_key === key)
  } catch (failure) {
    toast.error(failure instanceof Error ? failure.message : String(failure))
    return
  }
  if (!found) {
    toast.error(translate('buildWeb.recaps.taskMissing', 'build-web has no task {{key}}.', { key }))
    return
  }
  // Why the page unrecorded: the history gets the card, not an Issues list nobody saw.
  withoutPageRecording(() => useAppStore.getState().openBuildWebPage())
  useBuildWebStore.getState().openIssue(found.id, true)
  labelIssuePage(found.id, `${found.key} · ${found.title}`)
}
