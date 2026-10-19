import { defineMethod } from '../core'
import {
  BuildWebRecapReportParams,
  BuildWebRecapsParams
} from '../../../../shared/rpc-contract/build-web-task-params'

// The «Recaps» page: build-web's automation reports, behind the same host token as Issues.
export const BUILD_WEB_RECAP_METHODS = [
  defineMethod({
    name: 'buildWeb.recaps',
    permission: 'workspace',
    params: BuildWebRecapsParams,
    handler: async (params, { runtime }) => runtime.buildWebRecaps(params)
  }),
  defineMethod({
    name: 'buildWeb.recapReport',
    permission: 'workspace',
    params: BuildWebRecapReportParams,
    handler: async (params, { runtime }) => runtime.buildWebRecapReport(params)
  })
]
