import { defineMethod } from '../core'
import { WorktreeSelector } from '../../../../shared/rpc-contract/git-params'
import {
  GitChangedPathsParams,
  GitLogOperationParams,
  GitLogPageParams,
  GitRefsContainingParams,
  GitTreeAtRevisionParams
} from '../../../../shared/rpc-contract/git-log-page-params'

// The Git page: the same permission as Source Control, which also changes the repository.
export const GIT_LOG_PAGE_METHODS = [
  defineMethod({
    name: 'git.logPage',
    permission: 'workspace',
    params: GitLogPageParams,
    handler: async ({ worktree, ...query }, { runtime }) =>
      runtime.gitLogPage.getLogPage(worktree, query)
  }),
  defineMethod({
    name: 'git.refs',
    permission: 'workspace',
    params: WorktreeSelector,
    handler: async (params, { runtime }) => runtime.gitLogPage.listRefs(params.worktree)
  }),
  defineMethod({
    name: 'git.refsContaining',
    permission: 'workspace',
    params: GitRefsContainingParams,
    handler: async (params, { runtime }) =>
      runtime.gitLogPage.listRefsContaining(params.worktree, params.commitId)
  }),
  defineMethod({
    name: 'git.logOperation',
    permission: 'workspace',
    params: GitLogOperationParams,
    handler: async (params, { runtime }) =>
      runtime.gitLogPage.runOperation(params.worktree, params.operation)
  }),
  defineMethod({
    name: 'git.treeAtRevision',
    permission: 'workspace',
    params: GitTreeAtRevisionParams,
    handler: async (params, { runtime }) =>
      runtime.gitLogPage.treeAtRevision(params.worktree, params.commitId)
  }),
  defineMethod({
    name: 'git.changedPaths',
    permission: 'workspace',
    params: GitChangedPathsParams,
    handler: async (params, { runtime }) =>
      runtime.gitLogPage.changedPaths(params.worktree, params.base, params.target ?? null)
  })
]
