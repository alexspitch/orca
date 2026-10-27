import { z } from 'zod'
import type { BuildWebApi } from '../../../src/preload/api/build-web-api'
import type { BuildWebMobileMethod } from '../../../src/shared/build-web-mobile-methods'
import {
  BUILD_WEB_CLIENT_MARGIN_MS,
  buildWebHostWaitMs
} from '../../../src/shared/build-web-timeouts'
import { defineRpcOperation, runRpcOperation } from '../transport/rpc-operation'
import { rpcResultVariant } from '../transport/rpc-operation-result-reader'
import type { RpcMethodName } from '../transport/rpc-params-contract'
import type { UnvalidatedRpcRequestPort } from '../transport/unvalidated-rpc-request-port'

// The Issues page's build-web calls: the same RPC methods the desktop web client proxies to.

type BuildWebMethodOf<M> = M extends `buildWeb.${infer Short extends keyof BuildWebApi}`
  ? Short
  : never
export type BuildWebResult<Short extends keyof BuildWebApi> = Awaited<
  ReturnType<BuildWebApi[Short]>
>

// The host's own schemas own these shapes; mobile reads them as the shared types say.
function buildWebOperation<M extends RpcMethodName & `buildWeb.${keyof BuildWebApi}`>(method: M) {
  return defineRpcOperation({
    name: method,
    method,
    acceptance: 'require-result-or-throw-message',
    barrier: 'on-settle',
    read: rpcResultVariant(
      'build-web',
      z.custom<BuildWebResult<BuildWebMethodOf<M>>>(() => true)
    )
  })
}

const BUILD_WEB_OPERATIONS = {
  activity: buildWebOperation('buildWeb.activity'),
  addComment: buildWebOperation('buildWeb.addComment'),
  addRunImages: buildWebOperation('buildWeb.addRunImages'),
  adoptBuilt: buildWebOperation('buildWeb.adoptBuilt'),
  adoptImageSuccess: buildWebOperation('buildWeb.adoptImageSuccess'),
  archiveIssue: buildWebOperation('buildWeb.archiveIssue'),
  branches: buildWebOperation('buildWeb.branches'),
  buildCombos: buildWebOperation('buildWeb.buildCombos'),
  buildLog: buildWebOperation('buildWeb.buildLog'),
  cancelBuild: buildWebOperation('buildWeb.cancelBuild'),
  cancelJob: buildWebOperation('buildWeb.cancelJob'),
  clearAgentSession: buildWebOperation('buildWeb.clearAgentSession'),
  commitDiff: buildWebOperation('buildWeb.commitDiff'),
  connect: buildWebOperation('buildWeb.connect'),
  createIssueRun: buildWebOperation('buildWeb.createIssueRun'),
  createJiraIssue: buildWebOperation('buildWeb.createJiraIssue'),
  deleteComment: buildWebOperation('buildWeb.deleteComment'),
  deleteQuery: buildWebOperation('buildWeb.deleteQuery'),
  detectBuilt: buildWebOperation('buildWeb.detectBuilt'),
  detectImages: buildWebOperation('buildWeb.detectImages'),
  disconnect: buildWebOperation('buildWeb.disconnect'),
  editComment: buildWebOperation('buildWeb.editComment'),
  fetchRepo: buildWebOperation('buildWeb.fetchRepo'),
  getIssue: buildWebOperation('buildWeb.getIssue'),
  getIssueRun: buildWebOperation('buildWeb.getIssueRun'),
  getJob: buildWebOperation('buildWeb.getJob'),
  getRun: buildWebOperation('buildWeb.getRun'),
  guideShot: buildWebOperation('buildWeb.guideShot'),
  guideStream: buildWebOperation('buildWeb.guideStream'),
  imageFreshness: buildWebOperation('buildWeb.imageFreshness'),
  imageNames: buildWebOperation('buildWeb.imageNames'),
  imageTestSources: buildWebOperation('buildWeb.imageTestSources'),
  issueBuildBranches: buildWebOperation('buildWeb.issueBuildBranches'),
  issueCommits: buildWebOperation('buildWeb.issueCommits'),
  issueFile: buildWebOperation('buildWeb.issueFile'),
  issueMockupView: buildWebOperation('buildWeb.issueMockupView'),
  issueSummary: buildWebOperation('buildWeb.issueSummary'),
  jiraDraft: buildWebOperation('buildWeb.jiraDraft'),
  jiraInfo: buildWebOperation('buildWeb.jiraInfo'),
  jiraTransition: buildWebOperation('buildWeb.jiraTransition'),
  jiraTransitions: buildWebOperation('buildWeb.jiraTransitions'),
  lastBuilt: buildWebOperation('buildWeb.lastBuilt'),
  listAssignees: buildWebOperation('buildWeb.listAssignees'),
  listImageBuilds: buildWebOperation('buildWeb.listImageBuilds'),
  listImages: buildWebOperation('buildWeb.listImages'),
  listIssueChildren: buildWebOperation('buildWeb.listIssueChildren'),
  listIssues: buildWebOperation('buildWeb.listIssues'),
  listStands: buildWebOperation('buildWeb.listStands'),
  listUiAccounts: buildWebOperation('buildWeb.listUiAccounts'),
  listVersions: buildWebOperation('buildWeb.listVersions'),
  noteProviderSession: buildWebOperation('buildWeb.noteProviderSession'),
  publishGuide: buildWebOperation('buildWeb.publishGuide'),
  pushImages: buildWebOperation('buildWeb.pushImages'),
  pushProgress: buildWebOperation('buildWeb.pushProgress'),
  pushRun: buildWebOperation('buildWeb.pushRun'),
  refreshGuideImages: buildWebOperation('buildWeb.refreshGuideImages'),
  refreshIssueVersion: buildWebOperation('buildWeb.refreshIssueVersion'),
  removeRunImages: buildWebOperation('buildWeb.removeRunImages'),
  resolveStand: buildWebOperation('buildWeb.resolveStand'),
  restoreIssue: buildWebOperation('buildWeb.restoreIssue'),
  runFreshness: buildWebOperation('buildWeb.runFreshness'),
  savedQueries: buildWebOperation('buildWeb.savedQueries'),
  saveGuide: buildWebOperation('buildWeb.saveGuide'),
  saveQuery: buildWebOperation('buildWeb.saveQuery'),
  setAgentSession: buildWebOperation('buildWeb.setAgentSession'),
  setFavorite: buildWebOperation('buildWeb.setFavorite'),
  setGuideTarget: buildWebOperation('buildWeb.setGuideTarget'),
  setTestingStatus: buildWebOperation('buildWeb.setTestingStatus'),
  shotsJob: buildWebOperation('buildWeb.shotsJob'),
  standVersion: buildWebOperation('buildWeb.standVersion'),
  startGuide: buildWebOperation('buildWeb.startGuide'),
  startGuideShots: buildWebOperation('buildWeb.startGuideShots'),
  startImageBuild: buildWebOperation('buildWeb.startImageBuild'),
  startImageGroupBuild: buildWebOperation('buildWeb.startImageGroupBuild'),
  status: buildWebOperation('buildWeb.status'),
  testConnection: buildWebOperation('buildWeb.testConnection'),
  tmsStands: buildWebOperation('buildWeb.tmsStands'),
  updateIssue: buildWebOperation('buildWeb.updateIssue'),
  versionBranches: buildWebOperation('buildWeb.versionBranches')
} as const satisfies {
  [M in BuildWebMobileMethod as M extends `buildWeb.${infer Short}` ? Short : never]: unknown
}

export type BuildWebMethod = keyof typeof BUILD_WEB_OPERATIONS
/** The desktop API's arguments: the same object the RPC method takes. */
export type BuildWebArgs<M extends BuildWebMethod> = Parameters<BuildWebApi[M]>

export async function callBuildWeb<M extends BuildWebMethod>(
  client: UnvalidatedRpcRequestPort,
  method: M,
  ...params: BuildWebArgs<M>
): Promise<BuildWebResult<M>> {
  const operation = BUILD_WEB_OPERATIONS[method]
  const result: unknown = await runRpcOperation(
    client,
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the map pairs each method with its own operation; TS cannot correlate a generic key with its entry.
    operation as (typeof BUILD_WEB_OPERATIONS)['status'],
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: params are typed by the method above; the shared operation type erases that pairing.
    (params[0] ?? null) as never,
    { timeoutMs: buildWebHostWaitMs(method, params[0]) + BUILD_WEB_CLIENT_MARGIN_MS }
  )
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the operation's reader typed this method's result; see buildWebOperation.
  return result as BuildWebResult<M>
}

/** A failed call's words, as the desktop toasts show them. */
export function buildWebErrorMessage(failure: unknown): string {
  return failure instanceof Error ? failure.message : String(failure)
}
