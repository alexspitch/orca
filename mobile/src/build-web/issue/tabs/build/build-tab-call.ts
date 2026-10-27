import { useMemo } from 'react'
import {
  BUILD_WEB_CONSOLE_FEATURES_RUNTIME_CAPABILITY,
  BUILD_WEB_PRODUCT_CP_RUNTIME_CAPABILITY,
  BUILD_WEB_REDOS_TWIN_RUNTIME_CAPABILITY
} from '../../../../../../src/shared/build-web-capability'
import { useBuildWebScreen, type BuildWebScreen } from '../../../build-web-screen-context'

const CP_REFUSAL = 'This Orca server does not know Chat Platform yet. Update the server.'
const TWIN_REFUSAL = 'This Orca server cannot derive a redos image again yet. Update the server.'
const DECISION_REFUSAL =
  'This Orca server cannot build a waiting redos image yet. Update the server.'

/** As the desktop client: an older server drops `twinDecision`, and the console then refuses the build. */
function decidesTwin(arg: unknown): boolean {
  return (
    typeof arg === 'object' && arg !== null && 'twinDecision' in arg && arg.twinDecision === true
  )
}

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
    const knowsTwin = hostCapabilities.includes(BUILD_WEB_REDOS_TWIN_RUNTIME_CAPABILITY)
    const knowsDecision = hostCapabilities.includes(BUILD_WEB_CONSOLE_FEATURES_RUNTIME_CAPABILITY)
    const gated: BuildWebScreen['call'] = (method, ...params) =>
      !knowsCp && namesChatPlatform(params[0])
        ? Promise.reject(new Error(CP_REFUSAL))
        : !knowsTwin && method === 'retryRedosTwin'
          ? Promise.reject(new Error(TWIN_REFUSAL))
          : !knowsDecision && decidesTwin(params[0])
            ? Promise.reject(new Error(DECISION_REFUSAL))
            : call(method, ...params)
    return { call: gated }
  }, [call, hostCapabilities])
}

export const messageOf = (failure: unknown): string =>
  failure instanceof Error ? failure.message : String(failure)
