import { defineMethod } from '../core'
import {
  BuildWebAgentSessionParams,
  BuildWebClearSessionParams,
  BuildWebCommentParams,
  BuildWebConnect,
  BuildWebFavoriteParams,
  BuildWebIssueId,
  BuildWebIssueQueryParams,
  BuildWebIssueUpdateParams,
  BuildWebProviderSessionParams,
  BuildWebVersionsParams
} from '../../../../shared/rpc-contract/build-web-params'

// The token lives on the host that runs these, and every paired client acts as its owner.
export const BUILD_WEB_METHODS = [
  defineMethod({
    name: 'buildWeb.connect',
    permission: 'accounts-admin',
    params: BuildWebConnect,
    handler: async (params, { runtime }) => runtime.buildWebConnect(params)
  }),
  defineMethod({
    name: 'buildWeb.disconnect',
    permission: 'accounts-admin',
    params: null,
    handler: async (_params, { runtime }) => runtime.buildWebDisconnect()
  }),
  defineMethod({
    name: 'buildWeb.status',
    permission: 'workspace',
    params: null,
    handler: async (_params, { runtime }) => runtime.buildWebStatus()
  }),
  defineMethod({
    name: 'buildWeb.testConnection',
    permission: 'workspace',
    params: null,
    handler: async (_params, { runtime }) => runtime.buildWebTestConnection()
  }),
  defineMethod({
    name: 'buildWeb.listIssues',
    permission: 'workspace',
    params: BuildWebIssueQueryParams,
    handler: async (params, { runtime, signal }) => runtime.buildWebListIssues(params, signal)
  }),
  defineMethod({
    name: 'buildWeb.getIssue',
    permission: 'workspace',
    params: BuildWebIssueId,
    handler: async (params, { runtime, signal }) => runtime.buildWebGetIssue(params, signal)
  }),
  defineMethod({
    name: 'buildWeb.listAssignees',
    permission: 'workspace',
    params: null,
    handler: async (_params, { runtime }) => runtime.buildWebListAssignees()
  }),
  defineMethod({
    name: 'buildWeb.listVersions',
    permission: 'workspace',
    params: BuildWebVersionsParams,
    handler: async (params, { runtime }) => runtime.buildWebListVersions(params)
  }),
  defineMethod({
    name: 'buildWeb.updateIssue',
    permission: 'workspace',
    params: BuildWebIssueUpdateParams,
    handler: async (params, { runtime }) => runtime.buildWebUpdateIssue(params)
  }),
  defineMethod({
    name: 'buildWeb.setFavorite',
    permission: 'workspace',
    params: BuildWebFavoriteParams,
    handler: async (params, { runtime }) => runtime.buildWebSetFavorite(params)
  }),
  defineMethod({
    name: 'buildWeb.addComment',
    permission: 'workspace',
    params: BuildWebCommentParams,
    handler: async (params, { runtime }) => runtime.buildWebAddComment(params)
  }),
  defineMethod({
    name: 'buildWeb.setAgentSession',
    permission: 'workspace',
    params: BuildWebAgentSessionParams,
    handler: async (params, { runtime }) => runtime.buildWebSetAgentSession(params)
  }),
  defineMethod({
    name: 'buildWeb.noteProviderSession',
    permission: 'workspace',
    params: BuildWebProviderSessionParams,
    handler: async (params, { runtime }) => runtime.buildWebNoteProviderSession(params)
  }),
  defineMethod({
    name: 'buildWeb.clearAgentSession',
    permission: 'workspace',
    params: BuildWebClearSessionParams,
    handler: async (params, { runtime }) => runtime.buildWebClearAgentSession(params)
  })
]
