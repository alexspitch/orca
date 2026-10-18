import type { PreloadApi } from '../../../../preload/api-types'
import { BUILD_WEB_RUNTIME_CAPABILITY } from '../../../../shared/build-web-capability'
import {
  BUILD_WEB_CLIENT_MARGIN_MS,
  buildWebHostWaitMs
} from '../../../../shared/build-web-timeouts'
import { translate } from '@/i18n/i18n'
import { assertRuntimeEnvironmentCapability } from '@/runtime/runtime-rpc-client'
import { createFallbackProxy } from './web-fallback-api'
import { callRuntimeResult } from './web-runtime-calls'
import { requireActiveEnvironment } from './web-runtime-session'

// The browser client's build-web calls: the same host waits and server check as callBuildWeb.
export function createWebBuildWebApi(): PreloadApi['buildWeb'] {
  return createFallbackProxy(['buildWeb'], async (path, args) => {
    const name = path.at(-1) ?? ''
    await assertRuntimeEnvironmentCapability(
      requireActiveEnvironment().id,
      BUILD_WEB_RUNTIME_CAPABILITY,
      translate(
        'buildWeb.client.updateServer',
        'This Orca server does not support build-web yet. Update the server to use Issues.'
      )
    )
    return callRuntimeResult(
      `buildWeb.${name}`,
      args[0],
      buildWebHostWaitMs(name, args[0]) + BUILD_WEB_CLIENT_MARGIN_MS
    )
  })
}
