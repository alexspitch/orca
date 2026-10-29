import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import type { OpenBuildWebTaskState } from '../../../../shared/editor-tab-view-types'
import { useBuildWebStore } from './build-web-store'
import { useBuildWebStatus, useBuildWebTarget } from './use-build-web-data'
import { BuildWebListState } from './BuildWebListState'
import { BuildWebTakeToWorkDialog } from './BuildWebTakeToWorkDialog'
import { useTakeToWork } from './use-take-to-work'
import { BuildWebIssueFullScreen } from './issue/BuildWebIssueFullScreen'
import { BuildLogDialog } from './images/BuildLogDialog'

// IS-147: a task's card as a tab of the workspace whose row number opened it. Links out of the
// card (the Issues crumb, a parent, a subtask) lead to the build-web page, which keeps its own tabs.

function openOnPage(issueId: string | null): void {
  useAppStore.getState().openBuildWebPage()
  useBuildWebStore.getState().openIssue(issueId, issueId !== null)
}

export default function BuildWebTaskTabPanel({
  task,
  worktreeId
}: {
  task: OpenBuildWebTaskState
  /** The workspace the tab belongs to: the card reads its task only while that one is shown. */
  worktreeId: string
}): React.JSX.Element {
  const { target, contextKey } = useBuildWebTarget()
  const visible = useAppStore(
    (s) => s.activeView === 'terminal' && s.activeWorktreeId === worktreeId
  )
  useBuildWebStatus()
  const status = useBuildWebStore((s) => (s.contextKey === contextKey ? s.status : null))
  const { taking, takeToWork, closeTaking } = useTakeToWork()
  if (contextKey !== task.contextKey) {
    return (
      <BuildWebListState
        kind="error"
        error={translate(
          'buildWeb.taskTab.otherHost',
          '{{key}} is read through another host. Switch back to it to see the card.',
          { key: task.key }
        )}
      />
    )
  }
  if (!status) {
    return <BuildWebListState kind="loading" />
  }
  if (!status.connected) {
    return (
      <BuildWebListState
        kind="error"
        error={translate(
          'buildWeb.taskTab.disconnected',
          'build-web is not connected on this host.'
        )}
      />
    )
  }
  return (
    <div className="flex h-full min-h-0 flex-col bg-background pt-3">
      <BuildWebIssueFullScreen
        key={task.issueId}
        onTakeToWork={takeToWork}
        inWorkspaceTab={{
          issueId: task.issueId,
          visible,
          onOpenIssue: (id) => openOnPage(id),
          onBackToList: () => openOnPage(null)
        }}
      />
      <BuildWebTakeToWorkDialog issues={taking} onClose={closeTaking} />
      <BuildLogDialog target={target} />
    </div>
  )
}
