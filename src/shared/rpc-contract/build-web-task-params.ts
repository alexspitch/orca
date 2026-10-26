import { z } from 'zod'
import { BUILD_WEB_PUSH_AFTER, BUILD_WEB_TESTING_STATUSES } from '../build-web-run-types'
import { BUILD_WEB_PRODUCTS } from '../build-web-types'

// The task card's Build, Guide and Properties calls. Same rules as build-web-params: one object
// per call, and an id never becomes `.` or `..` inside a URL path.

const notDotSegment = (value: string) => value !== '.' && value !== '..'
const Id = z.string().trim().min(1, 'Missing id').max(128).refine(notDotSegment, 'Invalid id')
const ShortText = z.string().max(200)
const Branch = z.string().trim().min(1, 'Pick a branch').max(200)
const JiraKey = z.string().regex(/^[A-Z][A-Z0-9_]*-\d+$/)
const Combo = z.object({
  image: z.string().trim().min(1).max(300),
  dist: ShortText,
  branch: Branch
})
const Combos = z.array(Combo).min(1).max(500)
const Testing = z.enum(BUILD_WEB_TESTING_STATUSES)

export const BuildWebRunId = z.object({ runId: Id })
export const BuildWebCombosParams = z.object({
  runId: Id,
  combos: Combos,
  pushAfter: z.enum(BUILD_WEB_PUSH_AFTER),
  skipTests: z.boolean()
})
export const BuildWebComboParams = z.object({ runId: Id, combo: Combo })
export const BuildWebRunCombosParams = z.object({ runId: Id, combos: Combos })
export const BuildWebFreshnessParams = z.object({ runId: Id, fetch: z.boolean() })
export const BuildWebTestingParams = z.object({ runId: Id, testingStatus: Testing })
export const BuildWebAdoptParams = z.object({ id: Id, testingStatus: Testing })
// Why only chat-platform: the monorepo is the console's default and its requests name none.
const Repo = z.literal('chat-platform').optional()
/** The repository a branch list, image list or fetch is of; absent is the monorepo. */
export const BuildWebRepoParams = z.object({ repo: Repo }).optional()
export const BuildWebImageFreshnessParams = z.object({
  product: z.string().trim().min(1).max(20),
  version: z.string().trim().min(1).max(40),
  dist: z.enum(['rhel', 'redos']),
  // Why: Refresh asks the console again rather than the copy main keeps for two minutes.
  force: z.boolean().optional()
})
export const BuildWebDetectParams = z.object({
  branch: Branch,
  ticket: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*-[\d.]+$/, 'Missing task number'),
  repo: Repo
})
export const BuildWebIssueRunParams = z.object({
  issueId: Id,
  ticket: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*-[\d.]+$/, 'Missing task number'),
  branch: Branch,
  images: z.array(z.string().trim().min(1).max(300)).max(500),
  extra: z.array(Combo).max(500),
  testingStatus: Testing,
  // Why: the console's own detect answer, sent back as it came; the console reads it, not Orca.
  detected: z.record(z.string(), z.unknown()).nullable(),
  excludeBranches: z.array(Branch).max(100).optional()
})
export const BuildWebGuideStartParams = z.object({
  runId: Id,
  feedback: z.string().max(4000).optional(),
  currentGuide: z.string().max(200_000).optional()
})
export const BuildWebGuideStreamParams = z.object({
  streamId: z.uuid(),
  offset: z.number().int().min(0)
})
export const BuildWebGuideTargetParams = z.object({
  runId: Id,
  standId: z.union([Id, z.null()]).optional(),
  accountId: z.union([Id, z.null()]).optional()
})
export const BuildWebJobParams = z.object({ jobId: Id })
export const BuildWebTrainParams = z.object({ trainId: Id })
export const BuildWebTrainRunsParams = z.object({
  trainId: Id,
  limit: z.number().int().min(1).max(200),
  offset: z.number().int().min(0).max(100_000),
  withActions: z.boolean()
})
export const BuildWebTrainActionsParams = z.object({ trainId: Id, runId: Id })
export const BuildWebPushProgressParams = z.object({ runIds: z.array(Id).max(50) })
export const BuildWebJiraKeyParams = z.object({ jiraKey: JiraKey })
export const BuildWebJiraTransitionParams = z.object({
  jiraKey: JiraKey,
  transition: z.string().trim().min(1).max(40)
})
export const BuildWebTmsStandsParams = z.object({ product: z.string().max(20) })
export const BuildWebStandParams = z.object({ standId: Id })
export const BuildWebJiraCreateParams = z.object({
  issueId: Id,
  summary: z.string().trim().min(1, 'Write a title').max(255),
  description: z.string().max(32_000),
  fixVersionIds: z.array(ShortText).max(10)
})
export const BuildWebRecapsParams = z.object({
  product: z.union([z.enum(BUILD_WEB_PRODUCTS), z.null()]),
  versionId: z.union([Id, z.null()]),
  // Optional: a client from before the automation filter does not send it.
  automationId: z.union([Id, z.null()]).optional(),
  from: z.union([z.iso.datetime(), z.null()]),
  to: z.union([z.iso.datetime(), z.null()]),
  limit: z.number().int().min(1).max(200),
  offset: z.number().int().min(0).max(100_000)
})
export const BuildWebTestWorkspaceParams = z.object({
  runId: Id,
  workspace: z.string().trim().min(1).max(500).refine(notDotSegment, 'Invalid workspace')
})
export const BuildWebTestCaseParams = z.object({ key: z.string().min(1).max(4_000) })
export const BuildWebRecapReportParams = z.object({
  runId: Id,
  offset: z
    .number()
    .int()
    .min(0)
    .max(64 * 1024 * 1024)
})
