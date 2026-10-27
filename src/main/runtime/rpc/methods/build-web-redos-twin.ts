import { BuildWebRedosTwinParams } from '../../../../shared/rpc-contract/build-web-task-params'
import { defineMethod } from '../core'

// IS-230: a failed redos twin derived again, behind the same host token and permission as Issues.
export const BUILD_WEB_REDOS_TWIN_METHODS = [
  defineMethod({
    name: 'buildWeb.retryRedosTwin',
    permission: 'workspace',
    params: BuildWebRedosTwinParams,
    handler: async (params, { runtime }) => runtime.buildWebRetryRedosTwin(params)
  })
]
