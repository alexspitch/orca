import { BuildWebSessionTranscriptParams } from '../../../../shared/rpc-contract/build-web-params'
import { readBuildWebSessionTranscript } from '../../../build-web/build-web-session-transcript'
import { defineMethod } from '../core'

// IS-147: a task session's log stays on the host that ran it; clients read it here, a page at a time.
export const BUILD_WEB_SESSION_TRANSCRIPT_METHODS = [
  defineMethod({
    name: 'buildWeb.sessionTranscript',
    permission: 'workspace',
    params: BuildWebSessionTranscriptParams,
    handler: async (params) => readBuildWebSessionTranscript(params)
  })
]
