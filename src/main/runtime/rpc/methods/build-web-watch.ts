import { defineMethod } from '../core'

// The «Testing» page: build-web's watch, behind the same host token and permission as Issues.
export const BUILD_WEB_WATCH_METHODS = [
  defineMethod({
    name: 'buildWeb.watch',
    permission: 'workspace',
    params: null,
    handler: async (_params, { runtime }) => runtime.buildWebWatch()
  }),
  defineMethod({
    name: 'buildWeb.watchCheck',
    permission: 'workspace',
    params: null,
    handler: async (_params, { runtime }) => runtime.buildWebWatchCheck()
  })
]
