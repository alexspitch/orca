import { defineMethod } from '../core'

// The titlebar's bell and task counter: build-web's own, behind the same host token as Issues.
export const BUILD_WEB_ACTIVITY_METHODS = [
  defineMethod({
    name: 'buildWeb.activity',
    permission: 'workspace',
    params: null,
    handler: async (_params, { runtime }) => runtime.buildWebActivity()
  }),
  defineMethod({
    name: 'buildWeb.notificationsSeen',
    permission: 'workspace',
    params: null,
    handler: async (_params, { runtime }) => runtime.buildWebNotificationsSeen()
  }),
  defineMethod({
    name: 'buildWeb.notificationsClear',
    permission: 'workspace',
    params: null,
    handler: async (_params, { runtime }) => runtime.buildWebNotificationsClear()
  })
]
