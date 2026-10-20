import { defineMethod } from '../core'
import {
  DevServicesRunParams,
  DevServicesStatusParams
} from '../../../../shared/rpc-contract/dev-services-params'

// The Services tab: the repo's own services command, run on the worktree's host.
export const DEV_SERVICES_METHODS = [
  defineMethod({
    name: 'devServices.status',
    permission: 'workspace',
    params: DevServicesStatusParams,
    handler: async (params, { runtime, signal }) => runtime.devServicesStatus(params, signal)
  }),
  defineMethod({
    name: 'devServices.run',
    permission: 'workspace',
    params: DevServicesRunParams,
    handler: async (params, { runtime }) => runtime.devServicesRun(params)
  })
]
