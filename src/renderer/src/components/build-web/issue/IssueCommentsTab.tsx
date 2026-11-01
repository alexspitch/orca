import { translate } from '@/i18n/i18n'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import type { IssueDetailState } from '../use-build-web-issue-detail'
import { BuildWebIssueComments } from '../BuildWebIssueComments'
import { OverviewPanel } from './IssueOverviewCards'
import { IssueCommentComposer } from './IssueCommentComposer'

/** IS-349: what people say about the task, on a tab of its own; what happened to it is elsewhere. */
export function IssueCommentsTab({
  target,
  state
}: {
  target: RuntimeClientTarget
  state: IssueDetailState
}) {
  const detail = state.detail
  if (!detail) {
    return null
  }
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-3">
      <OverviewPanel title={translate('buildWeb.detail.comments', 'Comments')}>
        <BuildWebIssueComments target={target} detail={detail} onChanged={state.reload} />
        <IssueCommentComposer target={target} state={state} />
      </OverviewPanel>
    </div>
  )
}
