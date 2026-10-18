import { z } from 'zod'
import { BUILD_WEB_ISSUE_SORTS, BUILD_WEB_STATUSES } from '../build-web-types'
import { BUILD_WEB_IMAGE_SORTS } from '../build-web-image-types'

// One object per call: the web client's generic proxy sends `buildWeb.<name>(args)`,
// and IPC validates with the same schemas, so both transports agree on every field.

const required = (message: string, max: number) => z.string().trim().min(1, message).max(max)

// Why: the id becomes a URL path segment, and URL resolution turns `.`/`..` into another endpoint.
const notDotSegment = (value: string) => value !== '.' && value !== '..'
const Id = required('Missing task id', 128).refine(notDotSegment, 'Invalid id')
const Status = z.enum(BUILD_WEB_STATUSES)
const Product = z.enum(['sa', 'dc', 'ap', 'storage', 'tools'])
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
  sort: z.enum(BUILD_WEB_ISSUE_SORTS).optional(),
  dir: z.enum(['asc', 'desc']).optional(),
  q: z.string().max(500).optional(),
  status: z.array(Status).max(BUILD_WEB_STATUSES.length).optional(),
  product: z.array(Product).max(5).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).max(100_000).optional()
})

export const BuildWebIssueId = z.object({ id: Id })

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
      for_ai: z.boolean().optional()
    })
    // Why strip, not strict: a newer client may send a field this host does not know yet.
    .strip()
})

export const BuildWebFavoriteParams = z.object({ id: Id, on: z.boolean() })

export const BuildWebCommentParams = z.object({
  id: Id,
  body: required('Write a comment', 4000),
  jira: z.boolean()
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
  })
})

export const BuildWebProviderSessionParams = z.object({
  id: Id,
  surfaceId: required('Missing session id', 200),
  providerSessionId: z.string().regex(/^[A-Za-z0-9._:-]{1,200}$/)
})

export const BuildWebClearSessionParams = z.object({
  id: Id,
  surfaceId: required('Missing session id', 200)
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

export const BuildWebImagePageParams = z.object(ImageFilters)

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
export const BuildWebGuideShotParams = z.object({
  runId: Id,
  slug: z
    .string()
    .regex(/^[A-Za-z0-9._-]{1,120}$/)
    .refine(notDotSegment, 'Invalid screenshot')
})
