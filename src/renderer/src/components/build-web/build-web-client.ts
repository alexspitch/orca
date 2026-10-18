import { BUILD_WEB_RUNTIME_CAPABILITY } from '../../../../shared/build-web-capability'
import {
  BUILD_WEB_CLIENT_MARGIN_MS,
  buildWebHostWaitMs
} from '../../../../shared/build-web-timeouts'
import type { RuntimeClientTarget } from '../../../../shared/runtime-client-target'
import type { BuildWebApi } from '../../../../preload/api/build-web-api'
import { assertRuntimeEnvironmentCapability, callRuntimeRpc } from '@/runtime/runtime-rpc-client'
import { translate } from '@/i18n/i18n'

type Method = keyof BuildWebApi
type ArgsOf<M extends Method> = Parameters<BuildWebApi[M]>
type ResultOf<M extends Method> = Awaited<ReturnType<BuildWebApi[M]>>

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
      timeoutMs: buildWebHostWaitMs(method, args[0]) + BUILD_WEB_CLIENT_MARGIN_MS
    })
  }
  const member: unknown = window.api.buildWeb[method]
  // Why: a window opened before an update keeps the old preload, which lacks newer methods.
  if (typeof member !== 'function') {
    throw new Error(
      translate(
        'buildWeb.client.restart',
        'This window was opened before Orca was updated. Restart Orca to use this.'
      )
    )
  }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: `member` is api[method], whose parameters and result are exactly ArgsOf<M> and ResultOf<M>; TS cannot correlate a generic key with its member.
  const fn = member as (...callArgs: ArgsOf<M>) => Promise<ResultOf<M>>
  return fn(...args)
}
