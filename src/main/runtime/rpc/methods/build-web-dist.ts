import { BuildWebRedosTwinParams } from '../../../../shared/rpc-contract/build-web-task-params'
import { defineMethod } from '../core'

// IS-230: the console's distribution rules and its redos twins, behind the same host token and
// permission as Issues.
export const BUILD_WEB_DIST_METHODS = [
  defineMethod({
    name: 'buildWeb.consoleFeatures',
    permission: 'workspace',
    params: null,
    handler: async (_params, { runtime }) => runtime.buildWebConsoleFeatures()
  }),
  defineMethod({
    name: 'buildWeb.retryRedosTwin',
    permission: 'workspace',
    params: BuildWebRedosTwinParams,
    handler: async (params, { runtime }) => runtime.buildWebRetryRedosTwin(params)
  })
]
