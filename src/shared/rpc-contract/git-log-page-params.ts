import { z } from 'zod'
import { FullGitObjectId, WorktreeSelector } from './git-params'
import {
  GIT_LOG_PAGE_MAX_LIMIT,
  GIT_LOG_PAGE_MAX_LOADED,
  GIT_LOG_PAGE_MAX_REFS,
  GIT_LOG_PAGE_MAX_SINCE_DAYS
} from '../git-log-page-types'

// Refs are re-validated host-side (isSafeGitLogRef) before they reach a git argv.
const GitLogScope = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('all') }),
  z.object({
    kind: z.literal('refs'),
    refs: z.array(z.string().min(1).max(1024)).min(1).max(GIT_LOG_PAGE_MAX_REFS)
  })
])

export const GitLogPageParams = WorktreeSelector.extend({
  scope: GitLogScope.optional(),
  limit: z.number().int().min(1).max(GIT_LOG_PAGE_MAX_LIMIT).optional(),
  skip: z.number().int().min(0).max(GIT_LOG_PAGE_MAX_LOADED).optional(),
  text: z.string().max(500).optional(),
  regex: z.boolean().optional(),
  matchCase: z.boolean().optional(),
  author: z.string().max(200).optional(),
  sinceDays: z.number().int().min(1).max(GIT_LOG_PAGE_MAX_SINCE_DAYS).optional()
})

export const GitRefsContainingParams = WorktreeSelector.extend({
  commitId: z
    .unknown()
    .transform((v) => (typeof v === 'string' ? v : ''))
    .pipe(FullGitObjectId)
})

// Names and refs are re-checked host-side (isSafeGitLogRef, check-ref-format) before git sees them.
const RefName = z.string().min(1).max(1024)
const CommitId = FullGitObjectId

const GitLogRefTarget = z.object({
  kind: z.enum(['local', 'remote', 'tag']),
  name: RefName
})

const GitLogOperationParam = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('checkout'), ref: GitLogRefTarget }),
  z.object({ kind: z.literal('checkoutRevision'), commit: CommitId }),
  z.object({
    kind: z.literal('createBranch'),
    name: RefName,
    startPoint: RefName,
    checkout: z.boolean()
  }),
  z.object({ kind: z.literal('renameBranch'), from: RefName, to: RefName }),
  z.object({ kind: z.literal('deleteBranch'), name: RefName, force: z.boolean() }),
  z.object({ kind: z.literal('deleteRemoteBranch'), remote: RefName, branch: RefName }),
  z.object({ kind: z.literal('merge'), ref: RefName }),
  z.object({ kind: z.literal('rebase'), onto: RefName }),
  z.object({ kind: z.literal('checkoutAndRebase'), branch: RefName, onto: RefName }),
  z.object({ kind: z.literal('updateBranch'), branch: RefName }),
  z.object({ kind: z.literal('pushBranch'), branch: RefName }),
  z.object({ kind: z.literal('fetchAll') }),
  z.object({ kind: z.literal('cherryPick'), commit: CommitId }),
  z.object({
    kind: z.literal('createTag'),
    name: RefName,
    commit: CommitId,
    message: z.string().max(10_000).optional()
  })
])

export const GitLogOperationParams = WorktreeSelector.extend({
  operation: GitLogOperationParam
})

export const GitTreeAtRevisionParams = WorktreeSelector.extend({
  commitId: CommitId
})

export const GitChangedPathsParams = WorktreeSelector.extend({
  base: CommitId,
  /** Omitted: compare with the working tree. */
  target: CommitId.optional()
})
