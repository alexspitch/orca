import { translate } from '@/i18n/i18n'
import { ResizableSplit } from './ResizableSplit'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import type { IssueDetailState } from '../use-build-web-issue-detail'
import type { BuildWebIssuePatch } from '../../../../../shared/build-web-types'
import type { BuildWebRun, BuildWebTestingStatus } from '../../../../../shared/build-web-run-types'
import { BuildWebIssueProperties } from '../BuildWebIssueProperties'
import { BuildWebIssueComments } from '../BuildWebIssueComments'
import { BuildWebIssueFiles } from '../BuildWebIssueFiles'
import { taskFilesOf } from '../build-web-issue-file-open'
import { EditableDescription, EditableSteps } from '../BuildWebIssueEditors'
import { BuildWebToneChip } from '../BuildWebToneChip'
import { BuildSummaryCard, JiraCard, OverviewPanel } from './IssueOverviewCards'
import { IssueCommentComposer } from './IssueCommentComposer'

export function IssueOverviewTab({
  target,
  state,
  run,
  showRuns,
  testing,
  onOpenBuild,
  onOpenIssue
}: {
  target: RuntimeClientTarget
  state: IssueDetailState
  /** The task's run, for the «Build» card; shown only where runs are read and the task is not a subtask. */
  run: BuildWebRun | null | undefined
  showRuns: boolean
  testing: { value: BuildWebTestingStatus; onChange: (value: BuildWebTestingStatus) => void } | null
  onOpenBuild: () => void
  onOpenIssue: (id: string) => void
}) {
  const detail = state.detail
  if (!detail) {
    return null
  }
  const save = (patch: BuildWebIssuePatch) => void state.save(patch)
  return (
    <ResizableSplit
      panel="overview"
      side="right"
      defaultWidth={380}
      minWidth={300}
      aside={
        <aside className="flex min-w-0 flex-col gap-4">
          {showRuns ? <BuildSummaryCard run={run} onOpenBuild={onOpenBuild} /> : null}
          <OverviewPanel title={translate('buildWeb.card.properties', 'Properties')}>
            <BuildWebIssueProperties
              target={target}
              detail={detail}
              assignees={state.assignees}
              versions={state.versions}
              disabled={state.saving}
              onSave={state.save}
              onReload={state.reload}
              testing={showRuns ? testing : null}
              onOpenParent={onOpenIssue}
            />
          </OverviewPanel>
          <OverviewPanel title={translate('buildWeb.card.work', 'Work')}>
            <div className="flex flex-col items-start gap-1 text-xs">
              {detail.branches.map((branch, n) => (
                <span key={branch} className="flex items-center gap-1">
                  <BuildWebToneChip label={branch} tone={null} mono />
                  {n === 0 ? (
                    <span className="font-sans text-muted-foreground">
                      {' '}
                      — {translate('buildWeb.card.buildBranch', 'build')}
                    </span>
                  ) : null}
                </span>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {translate('buildWeb.card.commitPrefix', 'Commits prefixed {{key}}', {
                key: detail.key
              })}
            </p>
          </OverviewPanel>
          <JiraCard target={target} detail={detail} canCreate onCreated={state.reload} />
        </aside>
      }
    >
      <div className="flex min-w-0 flex-col gap-4">
        <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 text-card-foreground">
          <EditableDescription detail={detail} canEdit saving={state.saving} onSave={save} />
          <EditableSteps detail={detail} canEdit saving={state.saving} onSave={save} />
        </section>
        {taskFilesOf(detail).length > 0 ? (
          <OverviewPanel
            title={translate('buildWeb.files.title', 'Attachments {{count}}', {
              count: taskFilesOf(detail).length
            })}
          >
            <BuildWebIssueFiles target={target} detail={detail} files={taskFilesOf(detail)} />
          </OverviewPanel>
        ) : null}
        <OverviewPanel title={translate('buildWeb.detail.comments', 'Comments')}>
          <BuildWebIssueComments target={target} detail={detail} onChanged={state.reload} />
          <IssueCommentComposer target={target} state={state} />
        </OverviewPanel>
      </div>
    </ResizableSplit>
  )
}
