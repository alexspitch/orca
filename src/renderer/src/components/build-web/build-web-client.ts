import { BUILD_WEB_RUNTIME_CAPABILITY } from '../../../../shared/build-web-capability'
import {
  BUILD_WEB_CATALOG_TIMEOUT_MS,
  BUILD_WEB_CLIENT_MARGIN_MS,
  BUILD_WEB_COMMITS_FETCH_TIMEOUT_MS,
  BUILD_WEB_REQUEST_TIMEOUT_MS
} from '../../../../shared/build-web-timeouts'
import type { RuntimeClientTarget } from '../../../../shared/runtime-client-target'
import type { BuildWebApi } from '../../../../preload/api/build-web-api'
import { assertRuntimeEnvironmentCapability, callRuntimeRpc } from '@/runtime/runtime-rpc-client'
import { translate } from '@/i18n/i18n'

type Method = keyof BuildWebApi
type ArgsOf<M extends Method> = Parameters<BuildWebApi[M]>
type ResultOf<M extends Method> = Awaited<ReturnType<BuildWebApi[M]>>

/** The host's own wait for this call, so a slow but healthy answer is not cut off here. */
function hostWaitMs(method: Method, args: unknown): number {
  if (method === 'issueCommits' && typeof args === 'object' && args && 'fetch' in args) {
    return args.fetch === true ? BUILD_WEB_COMMITS_FETCH_TIMEOUT_MS : BUILD_WEB_REQUEST_TIMEOUT_MS
  }
  return method === 'imageSummary' || method === 'listImages' || method === 'listImageBuilds'
    ? BUILD_WEB_CATALOG_TIMEOUT_MS
    : BUILD_WEB_REQUEST_TIMEOUT_MS
}

/**
 * One call to build-web through whichever host holds the token: this app's main process,
 * or a paired Orca server (which must announce `build-web.v1` first).
 */
export async function callBuildWeb<M extends Method>(
  target: RuntimeClientTarget,
  method: M,
  ...args: ArgsOf<M>
): Promise<ResultOf<M>> {
  if (target.kind === 'environment') {
    await assertRuntimeEnvironmentCapability(
      target.environmentId,
      BUILD_WEB_RUNTIME_CAPABILITY,
      translate(
        'buildWeb.client.updateServer',
        'This Orca server does not support build-web yet. Update the server to use Issues.'
      )
    )
    return callRuntimeRpc<ResultOf<M>>(target, `buildWeb.${method}`, args[0], {
      timeoutMs: hostWaitMs(method, args[0]) + BUILD_WEB_CLIENT_MARGIN_MS
    })
  }
  const api = window.api.buildWeb
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: `fn` is api[method], whose parameters and result are exactly ArgsOf<M> and ResultOf<M>; TS cannot correlate a generic key with its member.
  const fn = api[method] as (...callArgs: ArgsOf<M>) => Promise<ResultOf<M>>
  return fn(...args)
}
