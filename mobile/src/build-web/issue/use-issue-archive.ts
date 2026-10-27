import { useState } from 'react'
import type { BuildWebIssueDetail } from '../../../../src/shared/build-web-types'
import { BUILD_WEB_ISSUE_ARCHIVE_RUNTIME_CAPABILITY } from '../../../../src/shared/build-web-capability'
import { buildWebErrorMessage, callBuildWeb } from '../build-web-operations'
import { useBuildWebScreen } from '../build-web-screen-context'
import type { IssueConfirm } from './use-issue-confirm'

export type IssueArchiveState = {
  busy: boolean
  archive: () => void
  restore: () => void
}

/** «Archive» and «Restore» of the card, as on the console: any status, undone by the other. */
export function useIssueArchive(
  detail: Pick<BuildWebIssueDetail, 'id' | 'key' | 'children'> | null,
  confirm: IssueConfirm,
  onChanged: () => void
): IssueArchiveState {
  const { client, hostCapabilities, notify, listSync } = useBuildWebScreen()
  const [busy, setBusy] = useState(false)
  const run = async (method: 'archiveIssue' | 'restoreIssue', done: string): Promise<void> => {
    if (!detail) {
      return
    }
    if (!hostCapabilities.includes(BUILD_WEB_ISSUE_ARCHIVE_RUNTIME_CAPABILITY)) {
      notify('This Orca server cannot archive tasks yet. Update the server.', 'error')
      return
    }
    setBusy(true)
    try {
      const result = await callBuildWeb(client, method, { id: detail.id })
      if (result.ok) {
        // As the desktop: an archived task leaves the live list; a restored one comes back on reload.
        if (method === 'archiveIssue') {
          listSync.drop(detail.id)
        } else {
          listSync.reload()
        }
        onChanged()
        notify(done, 'success')
      } else {
        notify(result.error, 'error')
      }
    } catch (failure) {
      notify(buildWebErrorMessage(failure), 'error')
    } finally {
      setBusy(false)
    }
  }
  return {
    busy,
    // Why a question here, unlike the desktop: a stray tap on a phone is easy, and Restore is a screen away.
    archive: () => {
      if (!detail) {
        return
      }
      void confirm({
        title: `Archive ${detail.key}?`,
        message:
          detail.children > 0
            ? 'Its subtasks go to the archive too. Restore brings them back.'
            : 'Restore brings it back.',
        confirmLabel: 'Archive'
      }).then((accepted) => accepted && void run('archiveIssue', `${detail.key} is in the archive`))
    },
    restore: () => void run('restoreIssue', `${detail?.key ?? ''} is back`)
  }
}
