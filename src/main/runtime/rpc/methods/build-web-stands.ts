import { defineMethod } from '../core'
import {
  BuildWebStandHealthParams,
  BuildWebStandIdsParams,
  BuildWebStandLogsReadParams,
  BuildWebStandLogsStartParams,
  BuildWebStandLogsStopParams,
  BuildWebStandOpParams
} from '../../../../shared/rpc-contract/build-web-stand-params'
import { BuildWebStandParams } from '../../../../shared/rpc-contract/build-web-task-params'

// The «Stands» page: build-web's stands, behind the same host token as Issues.
export const BUILD_WEB_STAND_METHODS = [
  defineMethod({
    name: 'buildWeb.standGroups',
    permission: 'workspace',
    params: null,
    handler: async (_params, { runtime }) => runtime.buildWebStandGroups()
  }),
  defineMethod({
    name: 'buildWeb.standStatus',
    permission: 'workspace',
    params: BuildWebStandParams,
    handler: async (params, { runtime }) => runtime.buildWebStandStatus(params)
  }),
  defineMethod({
    name: 'buildWeb.standHealth',
    permission: 'workspace',
    params: BuildWebStandHealthParams,
    handler: async (params, { runtime }) => runtime.buildWebStandHealth(params)
  }),
  defineMethod({
    name: 'buildWeb.standAccounts',
    permission: 'workspace',
    params: BuildWebStandIdsParams,
    handler: async (params, { runtime }) => runtime.buildWebStandAccounts(params)
  }),
  defineMethod({
    name: 'buildWeb.standJobs',
    permission: 'workspace',
    params: BuildWebStandIdsParams,
    handler: async (params, { runtime }) => runtime.buildWebStandJobs(params)
  }),
  defineMethod({
    name: 'buildWeb.standOp',
    permission: 'workspace',
    params: BuildWebStandOpParams,
    handler: async (params, { runtime }) => runtime.buildWebStandOp(params)
  }),
  defineMethod({
    name: 'buildWeb.startStandLogs',
    permission: 'workspace',
    params: BuildWebStandLogsStartParams,
    handler: async (params, { runtime }) => runtime.buildWebStartStandLogs(params)
  }),
  defineMethod({
    name: 'buildWeb.standLogs',
    permission: 'workspace',
    params: BuildWebStandLogsReadParams,
    handler: async (params, { runtime }) => runtime.buildWebStandLogs(params)
  }),
  defineMethod({
    name: 'buildWeb.stopStandLogs',
    permission: 'workspace',
    params: BuildWebStandLogsStopParams,
    handler: async (params, { runtime }) => runtime.buildWebStopStandLogs(params)
  })
]
