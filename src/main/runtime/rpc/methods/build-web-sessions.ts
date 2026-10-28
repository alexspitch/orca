import {
  BuildWebAgentSessionSettingsParams,
  BuildWebLinkWorktreeSessionParams,
  BuildWebWorktreeSessionParams
} from '../../../../shared/rpc-contract/build-web-params'
import { keepBuildWebWorktreeSession } from '../../../build-web/build-web-session-keep'
import { linkBuildWebSessionToWorktree } from '../../../build-web/build-web-session-link'
import { defineMethod } from '../core'

// IS-147: a task worktree's session lifecycle — the owner's cleanup setting, and «Keep» and the
// session link, which run on the host that owns the worktree.
export const BUILD_WEB_SESSION_METHODS = [
  defineMethod({
    name: 'buildWeb.agentSessionSettings',
    permission: 'workspace',
    params: null,
    handler: async (_params, { runtime }) => runtime.buildWebAgentSessionSettings()
  }),
  defineMethod({
    name: 'buildWeb.setAgentSessionSettings',
    permission: 'workspace',
    params: BuildWebAgentSessionSettingsParams,
    handler: async (params, { runtime }) => runtime.buildWebSetAgentSessionSettings(params)
  }),
  defineMethod({
    name: 'buildWeb.keepWorktreeSession',
    permission: 'workspace',
    params: BuildWebWorktreeSessionParams,
    handler: async (params, { runtime }) => keepBuildWebWorktreeSession(runtime, params.worktreeId)
  }),
  defineMethod({
    name: 'buildWeb.linkWorktreeSession',
    permission: 'workspace',
    params: BuildWebLinkWorktreeSessionParams,
    handler: async (params, { runtime }) => ({
      ok: true as const,
      value: await linkBuildWebSessionToWorktree(runtime, params)
    })
  })
]
