import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import type { BuildWebRecap } from '../../../../../shared/build-web-recap-types'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import { findBuildWebTaskByKey, showBuildWebTaskCard } from '../open-task-by-key'
import { recordPage } from '../page-history/page-history-store'

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
  let found: Awaited<ReturnType<typeof findBuildWebTaskByKey>>
  try {
    found = await findBuildWebTaskByKey(target, key)
  } catch (failure) {
    toast.error(failure instanceof Error ? failure.message : String(failure))
    return
  }
  if (!found) {
    toast.error(translate('buildWeb.recaps.taskMissing', 'build-web has no task {{key}}.', { key }))
    return
  }
  showBuildWebTaskCard(found)
}
