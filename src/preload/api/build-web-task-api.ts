import type { BuildWebJiraOutcome, BuildWebMutationResult } from '../../shared/build-web-types'
import type {
  BuildWebAdoptResult,
  BuildWebBranch,
  BuildWebCombo,
  BuildWebDetect,
  BuildWebFreshness,
  BuildWebIssueRunArgs,
  BuildWebLastBuilt,
  BuildWebPushAfter,
  BuildWebRun,
  BuildWebTestingStatus
} from '../../shared/build-web-run-types'
import type {
  BuildWebGuidePiece,
  BuildWebJiraCreateArgs,
  BuildWebJiraDraft,
  BuildWebJiraInfo,
  BuildWebJiraTransition,
  BuildWebJob,
  BuildWebJobView,
  BuildWebStand,
  BuildWebStandVersion,
  BuildWebTmsStand,
  BuildWebUiAccount
} from '../../shared/build-web-task-types'

type RunWrite = Promise<BuildWebMutationResult<BuildWebRun | null>>

// The task card's Build, Guide and Properties calls; one object per call, as the RPC params.
export type BuildWebTaskApi = {
  buildCombos: (args: {
    runId: string
    combos: BuildWebCombo[]
    pushAfter: BuildWebPushAfter
    skipTests: boolean
  }) => Promise<BuildWebMutationResult<true>>
  cancelBuild: (args: {
    runId: string
    combo: BuildWebCombo
  }) => Promise<BuildWebMutationResult<true>>
  addRunImages: (args: { runId: string; combos: BuildWebCombo[] }) => RunWrite
  removeRunImages: (args: { runId: string; combos: BuildWebCombo[] }) => RunWrite
  detectBuilt: (args: { runId: string }) => RunWrite
  lastBuilt: (args: {
    runId: string
  }) => Promise<{ entries: BuildWebLastBuilt[]; probe_error: string | null }>
  runFreshness: (args: { runId: string; fetch: boolean }) => Promise<BuildWebFreshness>
  setTestingStatus: (args: { runId: string; testingStatus: BuildWebTestingStatus }) => RunWrite
  adoptBuilt: (args: {
    id: string
    testingStatus: BuildWebTestingStatus
  }) => Promise<BuildWebMutationResult<BuildWebAdoptResult>>
  detectImages: (args: { branch: string; ticket: string }) => Promise<BuildWebDetect>
  createIssueRun: (
    args: BuildWebIssueRunArgs
  ) => Promise<BuildWebMutationResult<{ id: string; existing: boolean }>>
  imageNames: () => Promise<string[]>
  branches: () => Promise<BuildWebBranch[]>
  fetchRepo: () => Promise<BuildWebMutationResult<BuildWebBranch[]>>
  imageTestSources: () => Promise<Record<string, string[]>>
  startGuide: (args: {
    runId: string
    feedback?: string
    currentGuide?: string
  }) => Promise<BuildWebMutationResult<{ streamId: string }>>
  guideStream: (args: { streamId: string; offset: number }) => Promise<BuildWebGuidePiece>
  setGuideTarget: (args: {
    runId: string
    standId?: string | null
    accountId?: string | null
  }) => RunWrite
  startGuideShots: (args: { runId: string }) => Promise<BuildWebMutationResult<BuildWebJob | null>>
  shotsJob: (args: { runId: string }) => Promise<BuildWebJob | null>
  getJob: (args: { jobId: string }) => Promise<BuildWebJobView>
  cancelJob: (args: { jobId: string }) => Promise<BuildWebMutationResult<string>>
  listStands: () => Promise<BuildWebStand[]>
  listUiAccounts: () => Promise<BuildWebUiAccount[]>
  resolveStand: (args: { runId: string }) => Promise<string | null>
  jiraInfo: (args: { jiraKey: string }) => Promise<BuildWebJiraInfo>
  jiraTransitions: (args: { jiraKey: string }) => Promise<BuildWebJiraTransition[]>
  jiraTransition: (args: {
    jiraKey: string
    transition: string
  }) => Promise<BuildWebMutationResult<string>>
  tmsStands: (args: { product: string }) => Promise<BuildWebTmsStand[]>
  standVersion: (args: { standId: string }) => Promise<BuildWebStandVersion>
  refreshIssueVersion: (args: { id: string }) => Promise<BuildWebMutationResult<true>>
  jiraDraft: (args: { id: string }) => Promise<BuildWebJiraDraft>
  createJiraIssue: (
    args: BuildWebJiraCreateArgs
  ) => Promise<BuildWebMutationResult<{ key: string; url: string }>>
  editComment: (args: {
    id: string
    commentId: string
    body: string
  }) => Promise<BuildWebMutationResult<{ jira: BuildWebJiraOutcome | null }>>
  deleteComment: (args: {
    id: string
    commentId: string
  }) => Promise<BuildWebMutationResult<{ jira: BuildWebJiraOutcome | null }>>
}
