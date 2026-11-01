import {
  BUILD_WEB_COMMENT_TELEGRAM_RUNTIME_CAPABILITY,
  BUILD_WEB_CONSOLE_FEATURES_RUNTIME_CAPABILITY,
  BUILD_WEB_ISSUE_ARCHIVE_RUNTIME_CAPABILITY,
  BUILD_WEB_ISSUE_ASSIGNEE_FILTER_RUNTIME_CAPABILITY,
  BUILD_WEB_ISSUE_AUTHOR_RUNTIME_CAPABILITY,
  BUILD_WEB_ISSUE_FAVORITE_SORT_RUNTIME_CAPABILITY,
  BUILD_WEB_ISSUE_TESTER_RUNTIME_CAPABILITY,
  BUILD_WEB_PRODUCT_CP_RUNTIME_CAPABILITY,
  BUILD_WEB_RUNTIME_CAPABILITY
} from '../../../../shared/build-web-capability'
import {
  BUILD_WEB_CLIENT_MARGIN_MS,
  buildWebHostWaitMs
} from '../../../../shared/build-web-timeouts'
import type { RuntimeClientTarget } from '../../../../shared/runtime-client-target'
import type { BuildWebApi } from '../../../../preload/api/build-web-api'
import {
  assertRuntimeEnvironmentCapability,
  callRuntimeRpc,
  runtimeEnvironmentSupportsCapability
} from '@/runtime/runtime-rpc-client'
import { translate } from '@/i18n/i18n'
import { statusFilterServed } from '../../../../shared/build-web-status-compat'
import { NEWER_METHODS, testerRefusal } from './build-web-newer-methods'

type Method = keyof BuildWebApi
type ArgsOf<M extends Method> = Parameters<BuildWebApi[M]>
type ResultOf<M extends Method> = Awaited<ReturnType<BuildWebApi[M]>>

const field = (value: unknown, name: string): unknown =>
  typeof value === 'object' && value !== null && name in value
    ? Object.fromEntries(Object.entries(value))[name]
    : undefined

/** The call names product `cp` — as a filter, a task's new product — or chat-platform's repository. */
export function namesChatPlatform(arg: unknown): boolean {
  const product = field(arg, 'product')
  return (
    product === 'cp' ||
    (Array.isArray(product) && product.includes('cp')) ||
    field(field(arg, 'patch'), 'product') === 'cp' ||
    field(arg, 'repo') === 'chat-platform'
  )
}

/** The call names IS-347's tester, «After the train» or self-testing: an older server refuses or drops them. */
export function namesIssueTester(arg: unknown): boolean {
  const patch = field(arg, 'patch') ?? field(arg, 'draft')
  return (
    field(arg, 'testingStatus') === 'SELF_TESTING' ||
    field(patch, 'status') === 'self_testing' ||
    field(patch, 'tester') !== undefined ||
    field(patch, 'after_train') !== undefined
  )
}

// Why: an older server's params schema refuses an argument value it predates with a raw
// validation error, so ask first and say what to update instead.
const NEWER_ARGUMENTS: {
  applies: (method: Method, arg: unknown) => boolean
  capability: string
  refusal: () => string
}[] = [
  {
    applies: (_method, arg) => namesChatPlatform(arg),
    capability: BUILD_WEB_PRODUCT_CP_RUNTIME_CAPABILITY,
    refusal: () =>
      translate(
        'buildWeb.client.updateServerChatPlatform',
        'This Orca server does not know Chat Platform yet. Update the server.'
      )
  },
  {
    // Why: an older server drops `twinDecision`, and the console then refuses the twin's build.
    applies: (method, arg) =>
      method === 'buildCombos' &&
      typeof arg === 'object' &&
      arg !== null &&
      'twinDecision' in arg &&
      arg.twinDecision === true,
    capability: BUILD_WEB_CONSOLE_FEATURES_RUNTIME_CAPABILITY,
    refusal: () =>
      translate(
        'buildWeb.client.updateServerTwinDecision',
        'This Orca server cannot build a waiting redos image yet. Update the server.'
      )
  },
  {
    applies: (method, arg) =>
      method === 'listIssues' &&
      typeof arg === 'object' &&
      arg !== null &&
      'sort' in arg &&
      arg.sort === 'favorite',
    capability: BUILD_WEB_ISSUE_FAVORITE_SORT_RUNTIME_CAPABILITY,
    refusal: () =>
      translate(
        'buildWeb.client.updateServerFavoriteSort',
        'This Orca server cannot sort tasks by favorites yet. Update the server, or sort by another column.'
      )
  },
  {
    applies: (method, arg) =>
      method === 'listIssues' &&
      typeof arg === 'object' &&
      arg !== null &&
      'archived' in arg &&
      arg.archived === true,
    capability: BUILD_WEB_ISSUE_ARCHIVE_RUNTIME_CAPABILITY,
    refusal: () =>
      translate(
        'buildWeb.client.updateServerArchiveList',
        'This Orca server cannot list the archive yet. Update the server, or turn the Archive filter off.'
      )
  },
  {
    // Why the list only: an older server drops `assignee` and would list everyone's tasks as if
    // filtered; the sidebar badge then just counts without it.
    applies: (method, arg) => {
      const assignee = field(arg, 'assignee')
      return method === 'listIssues' && Array.isArray(assignee) && assignee.length > 0
    },
    capability: BUILD_WEB_ISSUE_ASSIGNEE_FILTER_RUNTIME_CAPABILITY,
    refusal: () =>
      translate(
        'buildWeb.client.updateServerAssigneeFilter',
        'This Orca server cannot filter tasks by assignee yet. Update the server, or clear the Assignee filter.'
      )
  },
  {
    applies: (_method, arg) => namesIssueTester(arg),
    capability: BUILD_WEB_ISSUE_TESTER_RUNTIME_CAPABILITY,
    refusal: testerRefusal
  },
  {
    // Why: an older server strips both from the patch, and the console then changes nothing.
    applies: (method, arg) => {
      const patch = field(arg, 'patch')
      return (
        method === 'updateIssue' &&
        (field(patch, 'jira_author') !== undefined ||
          field(patch, 'notify_recipients') !== undefined)
      )
    },
    capability: BUILD_WEB_ISSUE_AUTHOR_RUNTIME_CAPABILITY,
    refusal: () =>
      translate(
        'buildWeb.client.updateServerAuthor',
        'This Orca server cannot change a task’s author and extra recipients yet. Update the server.'
      )
  },
  {
    applies: (method, arg) =>
      method === 'addComment' &&
      typeof arg === 'object' &&
      arg !== null &&
      'telegram' in arg &&
      arg.telegram === true,
    capability: BUILD_WEB_COMMENT_TELEGRAM_RUNTIME_CAPABILITY,
    refusal: () =>
      translate(
        'buildWeb.client.updateServerCommentTelegram',
        'This Orca server cannot send a comment to Telegram yet. Update the server, or send it to the console.'
      )
  }
]

const LIST_FILTER_METHODS: ReadonlySet<Method> = new Set<Method>(['listIssues', 'issueSummary'])

/** Why: the default Open filter holds self-testing, which an older server's status enum refuses. */
async function listFilterServed(
  environmentId: string,
  method: Method,
  arg: unknown
): Promise<unknown> {
  const status = field(arg, 'status')
  if (!LIST_FILTER_METHODS.has(method) || !Array.isArray(status) || typeof arg !== 'object') {
    return arg
  }
  const servesTester =
    !status.includes('self_testing') ||
    (await runtimeEnvironmentSupportsCapability(
      environmentId,
      BUILD_WEB_ISSUE_TESTER_RUNTIME_CAPABILITY
    ))
  const served = statusFilterServed(status, servesTester)
  if (served === null) {
    throw new Error(testerRefusal())
  }
  return { ...arg, status: served }
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
    const newer = [
      ...NEWER_METHODS.filter((n) => n.methods.has(method)),
      ...NEWER_ARGUMENTS.filter((n) => n.applies(method, args[0]))
    ]
    for (const { capability, refusal } of newer) {
      await assertRuntimeEnvironmentCapability(target.environmentId, capability, refusal())
    }
    const params = await listFilterServed(target.environmentId, method, args[0])
    return callRuntimeRpc<ResultOf<M>>(target, `buildWeb.${method}`, params, {
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
