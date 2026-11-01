import { BuildWebIssueId } from '../../../../shared/rpc-contract/build-web-params'
import {
  getBuildWebDeployNotes,
  startBuildWebDeployNotes
} from '../../../build-web/build-web-deploy-notes'
import { defineMethod } from '../core'

// IS-341: the note for the deployment engineers that the console writes as a task goes out.
export const BUILD_WEB_DEPLOY_NOTES_METHODS = [
  defineMethod({
    name: 'buildWeb.deployNotes',
    permission: 'workspace',
    params: BuildWebIssueId,
    handler: async (params) => getBuildWebDeployNotes(params.id)
  }),
  defineMethod({
    name: 'buildWeb.startDeployNotes',
    permission: 'workspace',
    params: BuildWebIssueId,
    handler: async (params) => startBuildWebDeployNotes(params.id)
  })
]
