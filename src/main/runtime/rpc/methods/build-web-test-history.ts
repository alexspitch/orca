import { defineMethod } from '../core'
import {
  BuildWebRunId,
  BuildWebTestCaseParams,
  BuildWebTestWorkspaceParams
} from '../../../../shared/rpc-contract/build-web-task-params'

// The «Test history» tab of Testing: build-web's test runs, behind the same host token as Issues.
export const BUILD_WEB_TEST_HISTORY_METHODS = [
  defineMethod({
    name: 'buildWeb.testRuns',
    permission: 'workspace',
    params: null,
    handler: async (_params, { runtime }) => runtime.buildWebTestRuns()
  }),
  defineMethod({
    name: 'buildWeb.testRun',
    permission: 'workspace',
    params: BuildWebRunId,
    handler: async (params, { runtime }) => runtime.buildWebTestRun(params)
  }),
  defineMethod({
    name: 'buildWeb.testRunWorkspace',
    permission: 'workspace',
    params: BuildWebTestWorkspaceParams,
    handler: async (params, { runtime }) => runtime.buildWebTestRunWorkspace(params)
  }),
  defineMethod({
    name: 'buildWeb.testCase',
    permission: 'workspace',
    params: BuildWebTestCaseParams,
    handler: async (params, { runtime }) => runtime.buildWebTestCase(params)
  }),
  defineMethod({
    name: 'buildWeb.testNightly',
    permission: 'workspace',
    params: null,
    handler: async (_params, { runtime }) => runtime.buildWebTestNightly()
  })
]
