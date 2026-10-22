import { useState } from 'react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import type { BuildWebIssueDetail } from '../../../../../shared/build-web-types'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import { callBuildWeb } from '../build-web-client'
import { useBuildWebStore } from '../build-web-store'

export type IssueArchiveState = {
  busy: boolean
  archive: () => void
  restore: () => void
}

/** The task's family leaves the list it was shown in: archived from the live one, back from the archive. */
function dropFromList(id: string): void {
  const store = useBuildWebStore.getState()
  const kept = store.issues.filter((row) => row.id !== id && row.parent_id !== id)
  store.setIssues(kept, Math.max(0, store.total - (store.issues.length - kept.length)))
}

/** «Archive» and «Restore» of the card, as on the console: any status, no question, undone by the other. */
export function useIssueArchive(
  target: RuntimeClientTarget,
  /** Null while the card loads; nothing to archive yet. */
  detail: Pick<BuildWebIssueDetail, 'id' | 'key'> | null,
  onChanged: () => void
): IssueArchiveState {
  const [busy, setBusy] = useState(false)
  const run = async (method: 'archiveIssue' | 'restoreIssue', done: string): Promise<void> => {
    if (!detail) {
      return
    }
    setBusy(true)
    try {
      const result = await callBuildWeb(target, method, { id: detail.id })
      if (result.ok) {
        dropFromList(detail.id)
        onChanged()
        toast.success(done)
      } else {
        toast.error(result.error)
      }
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : String(failure))
    } finally {
      setBusy(false)
    }
  }
  return {
    busy,
    archive: () =>
      void run(
        'archiveIssue',
        translate('buildWeb.archive.done', '{{key}} is in the archive', { key: detail?.key ?? '' })
      ),
    restore: () =>
      void run(
        'restoreIssue',
        translate('buildWeb.archive.restored', '{{key}} is back', { key: detail?.key ?? '' })
      )
  }
}
