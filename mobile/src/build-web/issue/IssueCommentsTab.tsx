import { OverviewPanel } from './issue-card-ui'
import { IssueCommentComposer } from './IssueCommentComposer'
import { IssueComments } from './IssueComments'
import type { IssueConfirm } from './use-issue-confirm'
import type { IssueDetailState } from './use-issue-detail'

/** The desktop's IssueCommentsTab (IS-349): what people say about the task, on a tab of its own. */
export function IssueCommentsTab({
  state,
  confirm
}: {
  state: IssueDetailState
  confirm: IssueConfirm
}) {
  const detail = state.detail
  if (!detail) {
    return null
  }
  return (
    <OverviewPanel title="Comments">
      <IssueComments detail={detail} confirm={confirm} onChanged={state.reload} />
      <IssueCommentComposer state={state} confirm={confirm} />
    </OverviewPanel>
  )
}
