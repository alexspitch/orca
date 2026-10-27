import { useMemo } from 'react'
import { BUILD_WEB_PRODUCT_CP_RUNTIME_CAPABILITY } from '../../../../../../src/shared/build-web-capability'
import { useBuildWebScreen, type BuildWebScreen } from '../../../build-web-screen-context'

const CP_REFUSAL = 'This Orca server does not know Chat Platform yet. Update the server.'

/** As the desktop client: a call naming chat-platform's repository needs a server that knows it. */
function namesChatPlatform(arg: unknown): boolean {
  return typeof arg === 'object' && arg !== null && 'repo' in arg && arg.repo === 'chat-platform'
}

export type BuildTabCalls = {
  call: BuildWebScreen['call']
}

/** The screen's build-web calls, gated as the desktop client gates them. */
export function useBuildTabCall(): BuildTabCalls {
  const { call, hostCapabilities } = useBuildWebScreen()
  return useMemo(() => {
    const knowsCp = hostCapabilities.includes(BUILD_WEB_PRODUCT_CP_RUNTIME_CAPABILITY)
    const gated: BuildWebScreen['call'] = (method, ...params) =>
      !knowsCp && namesChatPlatform(params[0])
        ? Promise.reject(new Error(CP_REFUSAL))
        : call(method, ...params)
    return { call: gated }
  }, [call, hostCapabilities])
}

export const messageOf = (failure: unknown): string =>
  failure instanceof Error ? failure.message : String(failure)
