import { StyleSheet, View } from 'react-native'
import type { BuildWebRun, BuildWebTestingStatus } from '../../../../src/shared/build-web-run-types'
import { spacing } from '../../theme/mobile-theme'
import { useBuildWebScreen } from '../build-web-screen-context'
import { OverviewPanel } from './issue-card-ui'
import { taskFilesOf } from './issue-attachment-kind'
import { IssueAttachments } from './IssueAttachments'
import { IssueCommentComposer } from './IssueCommentComposer'
import { IssueComments } from './IssueComments'
import { IssueDescriptionSection } from './IssueDescriptionSection'
import { BuildSummaryCard, JiraCard, WorkCard } from './IssueOverviewCards'
import { IssueProperties } from './IssueProperties'
import type { IssueConfirm } from './use-issue-confirm'
import type { IssueDetailState } from './use-issue-detail'

/** The card's Overview: the desktop's two columns stacked — text, files and comments under the side cards. */
export function IssueOverviewTab({
  state,
  confirm,
  run,
  showRuns,
  testing,
  onOpenBuild
}: {
  state: IssueDetailState
  confirm: IssueConfirm
  run: BuildWebRun | null | undefined
  showRuns: boolean
  testing: { value: BuildWebTestingStatus; onChange: (value: BuildWebTestingStatus) => void }
  onOpenBuild: () => void
}) {
  const { openIssue } = useBuildWebScreen()
  const detail = state.detail
  if (!detail) {
    return null
  }
  const files = taskFilesOf(detail)
  return (
    <View style={styles.column}>
      <IssueDescriptionSection detail={detail} saving={state.saving} onSave={state.save} />
      {showRuns ? <BuildSummaryCard run={run} onOpenBuild={onOpenBuild} /> : null}
      <OverviewPanel title="Properties">
        <IssueProperties
          detail={detail}
          assignees={state.assignees}
          versions={state.versions}
          disabled={state.saving}
          onSave={state.save}
          onReload={state.reload}
          testing={showRuns ? testing : null}
          onOpenParent={(id) => openIssue(id)}
        />
      </OverviewPanel>
      <WorkCard detail={detail} />
      <JiraCard detail={detail} onCreated={state.reload} />
      {files.length > 0 ? (
        <OverviewPanel title={`Attachments ${files.length}`}>
          <IssueAttachments issueId={detail.id} files={files} />
        </OverviewPanel>
      ) : null}
      <OverviewPanel title="Comments">
        <IssueComments detail={detail} confirm={confirm} onChanged={state.reload} />
        <IssueCommentComposer state={state} confirm={confirm} />
      </OverviewPanel>
    </View>
  )
}

const styles = StyleSheet.create({
  column: { gap: spacing.lg }
})
