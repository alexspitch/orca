import { useCallback } from 'react'
import type { BuildWebIssueDetail } from '../../../../../../src/shared/build-web-types'
import { MobileMarkdown } from '../../../../components/MobileMarkdown'
import { worktreeFileLink } from '../../../../files/mobile-markdown-file-link'
import { useRouteHandoff } from '../../../../navigation/route-handoff'
import { buildWebErrorMessage } from '../../../build-web-operations'
import { useBuildWebScreen } from '../../../build-web-screen-context'
import { useOpenBuildWebSession } from '../../../list/use-open-build-web-session'

/**
 * A task's markdown file (plan, deploy note), as the desktop's IssueMarkdown: a file it names
 * opens in the task's workspace.
 */
export function IssueMarkdown({ detail, text }: { detail: BuildWebIssueDetail; text: string }) {
  const { hostId, notify } = useBuildWebScreen()
  const { findTaskWorktree } = useOpenBuildWebSession()
  const router = useRouteHandoff()
  const onOpenFile = useCallback(
    (pathText: string) => {
      void findTaskWorktree(detail)
        .then((worktree) => {
          if (!worktree) {
            notify('Take the task to work to open its files.', 'error')
            return
          }
          // Why: the file preview reads this host's workspaces; a server's opens from its session.
          if (worktree.hostId?.startsWith('runtime:')) {
            notify(
              'This task’s workspace is on a server: open its session to see the file.',
              'error'
            )
            return
          }
          const href = worktreeFileLink(
            { hostId, worktreeId: worktree.worktreeId, worktreeName: worktree.displayName },
            '',
            pathText
          )
          if (href) {
            router.push(href)
          } else {
            notify('Choose a file inside the task’s workspace.', 'error')
          }
        })
        .catch((failure: unknown) => notify(buildWebErrorMessage(failure), 'error'))
    },
    [detail, findTaskWorktree, hostId, notify, router]
  )
  return <MobileMarkdown content={text} onOpenFile={onOpenFile} />
}
