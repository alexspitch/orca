import { z } from 'zod'
import {
  BUILD_WEB_ISSUE_SORTS,
  BUILD_WEB_ISSUE_TYPES,
  BUILD_WEB_PRODUCTS,
  BUILD_WEB_STATUSES
} from '../build-web-types'
import { BUILD_WEB_IMAGE_SORTS } from '../build-web-image-types'

// One object per call: the web client's generic proxy sends `buildWeb.<name>(args)`,
// and IPC validates with the same schemas, so both transports agree on every field.

const required = (message: string, max: number) => z.string().trim().min(1, message).max(max)

// Why: the id becomes a URL path segment, and URL resolution turns `.`/`..` into another endpoint.
const notDotSegment = (value: string) => value !== '.' && value !== '..'
const Id = required('Missing task id', 128).refine(notDotSegment, 'Invalid id')
const Status = z.enum(BUILD_WEB_STATUSES)
const Product = z.enum(BUILD_WEB_PRODUCTS)
// Why: build-web's own limits — a longer value would be refused there with a less useful message.
const ShortText = z.string().max(200)

export const BuildWebConnect = z.object({
  baseUrl: required('Enter the build-web address', 2048),
  token: required('Enter a build-web API token', 4096)
})

export const BuildWebIssueQueryParams = z.object({
  view: z.enum(['mine', 'ai', 'favorite', 'all']),
  mine: z.boolean().optional(),
  ai: z.boolean().optional(),
  favorite: z.boolean().optional(),
  jira: z.boolean().optional(),
  sort: z.enum(BUILD_WEB_ISSUE_SORTS).optional(),
  dir: z.enum(['asc', 'desc']).optional(),
  q: z.string().max(500).optional(),
  status: z.array(Status).max(BUILD_WEB_STATUSES.length).optional(),
  product: z.array(Product).max(BUILD_WEB_PRODUCTS.length).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).max(100_000).optional(),
  tree: z.boolean().optional(),
  /** The archive instead of the live tasks; an older host would drop it, so it is asked first. */
  archived: z.boolean().optional()
})

export const BuildWebIssueId = z.object({ id: Id })

// Why every field optional: a client predating the filters asks with no params at all.
export const BuildWebIssueSummaryParams = z.object({
  mine: z.boolean().optional(),
  ai: z.boolean().optional(),
  favorite: z.boolean().optional(),
  jira: z.boolean().optional(),
  status: z.array(Status).max(BUILD_WEB_STATUSES.length).optional(),
  product: z.array(Product).max(BUILD_WEB_PRODUCTS.length).optional(),
  q: z.string().max(200).optional()
})

export const BuildWebVersionsParams = z.object({ product: Product })

export const BuildWebIssueUpdateParams = z.object({
  id: Id,
  patch: z
    .object({
      title: z.string().min(1).max(500).optional(),
      status: Status.optional(),
      priority: z.number().int().min(1).max(5).optional(),
      assignee: ShortText.optional(),
      version_id: z.union([ShortText, z.null()]).optional(),
      for_ai: z.boolean().optional(),
      type: z.enum(BUILD_WEB_ISSUE_TYPES).optional(),
      product: Product.optional(),
      stand_id: z.union([Id, z.null()]).optional(),
      stand_mode: ShortText.optional(),
      version: ShortText.optional(),
      description: z.string().max(100_000).optional(),
      steps: z
        .array(z.object({ text: z.string().max(4000) }))
        .max(200)
        .optional()
    })
    // Why strip, not strict: a newer client may send a field this host does not know yet.
    .strip()
})

export const BuildWebCommentEditParams = z.object({
  id: Id,
  commentId: Id,
  body: required('Write a comment', 4000)
})

export const BuildWebCommentDeleteParams = z.object({ id: Id, commentId: Id })

export const BuildWebFavoriteParams = z.object({ id: Id, on: z.boolean() })

export const BuildWebCommentParams = z.object({
  id: Id,
  body: required('Write a comment', 4000),
  jira: z.boolean(),
  // Why optional: older clients never send it; a client asks the capability before it does.
  telegram: z.boolean().optional()
})

export const BuildWebAgentSessionParams = z.object({
  id: Id,
  session: z.object({
    surface_kind: z.enum(['terminal', 'structured', 'unknown']),
    surface_id: required('Missing session id', 200),
    worktree_name: required('Missing worktree name', 200),
    execution_host_id: ShortText,
    agent: z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}$/),
    started_at: z.string().max(40)
  }),
  // IS-147: the host then records the console's session row on this worktree. Older hosts drop it.
  worktreeId: z.string().min(1).max(4096).optional()
})

export const BuildWebProviderSessionParams = z.object({
  id: Id,
  surfaceId: required('Missing session id', 200),
  providerSessionId: z.string().regex(/^[A-Za-z0-9._:-]{1,200}$/)
})

export const BuildWebClearSessionParams = z.object({
  id: Id,
  surfaceId: required('Missing session id', 200),
  // IS-147: the launch failed — the console ends the session as abandoned. Older hosts drop it.
  abandon: z.boolean().optional()
})

export const BuildWebAgentSessionSettingsParams = z.object({
  auto_cleanup: z.boolean()
})

/** A worktree the host owns, by id — the session actions run where the worktree lives. */
export const BuildWebWorktreeSessionParams = z.object({
  worktreeId: z.string().min(1).max(4096)
})

/** The console's session row, recorded on a worktree of this host made for that task. */
export const BuildWebLinkWorktreeSessionParams = BuildWebWorktreeSessionParams.extend({
  issueId: Id,
  sessionId: required('Missing session id', 200)
})

const ImageFilters = {
  sort: z.enum(BUILD_WEB_IMAGE_SORTS).optional(),
  dir: z.enum(['asc', 'desc']).optional(),
  q: z.string().max(200).optional(),
  products: z.array(z.string().max(20)).max(10).optional(),
  dists: z.array(z.string().max(20)).max(5).optional(),
  version: z.string().max(40).optional(),
  page: z.number().int().min(0).max(100_000),
  pageSize: z.number().int().min(1).max(200),
  refresh: z.boolean().optional()
}

export const BuildWebImagePageParams = z.object({
  ...ImageFilters,
  statuses: z
    .array(z.enum(['success', 'failed', 'running']))
    .max(3)
    .optional()
})

export const BuildWebImageHistoryParams = z.object({
  ...ImageFilters,
  image: required('Missing image', 300),
  pushed: z
    .array(z.enum(['yes', 'no']))
    .max(2)
    .optional(),
  statuses: z
    .array(z.enum(['success', 'failed', 'running']))
    .max(3)
    .optional()
})

export const BuildWebImagePushParams = z.object({
  runId: Id,
  combos: z
    .array(z.object({ image: required('Missing image', 300), dist: ShortText, branch: ShortText }))
    .min(1)
    .max(200),
  moveMainTag: z.boolean()
})

const BuildNumber = z.number().int().min(0).max(100_000_000)
export const BuildWebImageAdoptParams = z.object({
  image: required('Missing image', 300),
  dist: ShortText,
  number: BuildNumber,
  to: BuildNumber
})

export const BuildWebRunParams = z.object({ runId: Id })
export const BuildWebBuildLogParams = z.object({
  url: required('Missing log', 2048),
  offset: z.number().int().min(0)
})
export const BuildWebVersionBranchesParams = z.object({ product: ShortText })
const ImageBuildChoice = {
  branch: required('Pick a version', 200),
  dist: z.enum(['both', 'rhel', 'redos']),
  ticket: z
    .string()
    .trim()
    .regex(/^([A-Z][A-Z0-9_]*-\d+)?$/, 'A ticket looks like SDAP-1234')
    .optional(),
  skipTests: z.boolean().optional()
}
export const BuildWebImageBuildParams = z.object({
  image: required('Missing image', 300),
  ...ImageBuildChoice
})
export const BuildWebImageGroupBuildParams = z.object({
  images: z.array(required('Missing image', 300)).min(1).max(100),
  ...ImageBuildChoice
})
export const BuildWebPushRunParams = z.object({ runId: Id, moveMainTag: z.boolean() })
export const BuildWebGuideParams = z.object({ runId: Id, guide: z.string().max(200_000) })
export const BuildWebPublishGuideParams = z.object({
  jiraKey: z.string().regex(/^[A-Z][A-Z0-9_]*-\d+$/),
  runId: Id,
  guide: z.string().max(200_000)
})
export const BuildWebCommitsParams = z.object({ id: Id, fetch: z.boolean() })
export const BuildWebCommitDiffParams = z.object({
  id: Id,
  sha: z.string().regex(/^[0-9a-f]{7,40}$/i)
})
const FileId = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/)
export const BuildWebIssueFileParams = z.object({ id: Id, fileId: FileId })
// Why the cap: a file larger than Orca opens never comes back from `issueFile`.
export const BuildWebStageIssueFileParams = z.object({
  issueKey: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  fileId: FileId,
  name: z.string().min(1).max(255),
  base64: z.string().max(Math.ceil((3 * 1024 * 1024) / 3) * 4)
})
export const BuildWebGuideShotParams = z.object({
  runId: Id,
  slug: z
    .string()
    .regex(/^[A-Za-z0-9._-]{1,120}$/)
    .refine(notDotSegment, 'Invalid screenshot')
})

const FilterValues = z.array(z.string().max(320)).max(100)
export const BuildWebSavedFilterSchema = z.object({
  q: z.string().max(500),
  product: FilterValues,
  type: FilterValues,
  status: FilterValues,
  version: FilterValues,
  verdict: FilterValues,
  jira: FilterValues,
  author: FilterValues,
  assignee: FilterValues,
  stand: FilterValues,
  mode: FilterValues,
  from: z.string().max(32),
  to: z.string().max(32),
  rootOnly: z.boolean(),
  favorite: z.boolean(),
  mine: z.boolean(),
  ai: z.boolean()
})

export const BuildWebSavedQueriesParams = z.object({
  products: z.array(Product).min(1).max(BUILD_WEB_PRODUCTS.length)
})

export const BuildWebSavedQuerySaveParams = z.object({
  product: Product,
  name: required('Name the query', 200),
  shared: z.boolean(),
  filter: BuildWebSavedFilterSchema
})

export const BuildWebSavedQueryDeleteParams = z.object({
  id: required('Missing query id', 128).refine(notDotSegment, 'Invalid id')
})

/** IS-147: a session's agent log on the host that ran it, a page at a time from its end. */
export const BuildWebSessionTranscriptParams = z.object({
  agent: z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}$/),
  // Why so strict: the id names a file under the agent's log folders.
  providerSessionId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/),
  before: z.number().int().nonnegative().optional()
})
