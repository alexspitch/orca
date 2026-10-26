import {
  BUILD_WEB_ACTIVITY_RUNTIME_CAPABILITY,
  BUILD_WEB_COMMENT_TELEGRAM_RUNTIME_CAPABILITY,
  BUILD_WEB_IMAGE_ADOPT_RUNTIME_CAPABILITY,
  BUILD_WEB_IMAGE_FRESHNESS_RUNTIME_CAPABILITY,
  BUILD_WEB_IMAGE_GROUP_BUILD_RUNTIME_CAPABILITY,
  BUILD_WEB_ISSUE_ARCHIVE_RUNTIME_CAPABILITY,
  BUILD_WEB_ISSUE_FAVORITE_SORT_RUNTIME_CAPABILITY,
  BUILD_WEB_ISSUE_FILES_RUNTIME_CAPABILITY,
  BUILD_WEB_PRODUCT_CP_RUNTIME_CAPABILITY,
  BUILD_WEB_ISSUE_MOCKUPS_RUNTIME_CAPABILITY,
  BUILD_WEB_RUNTIME_CAPABILITY,
  BUILD_WEB_SAVED_QUERIES_RUNTIME_CAPABILITY,
  BUILD_WEB_STAND_HEALTH_RUNTIME_CAPABILITY,
  BUILD_WEB_STANDS_RUNTIME_CAPABILITY,
  BUILD_WEB_TEST_HISTORY_RUNTIME_CAPABILITY,
  BUILD_WEB_TRAINS_ROLLING_RUNTIME_CAPABILITY
} from '../../../../shared/build-web-capability'
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

const STAND_METHODS: ReadonlySet<Method> = new Set<Method>([
  'standGroups',
  'standStatus',
  'standAccounts',
  'standJobs',
  'standOp',
  'startStandLogs',
  'standLogs',
  'stopStandLogs'
])
const TEST_HISTORY_METHODS: ReadonlySet<Method> = new Set<Method>([
  'testRuns',
  'testRun',
  'testRunWorkspace',
  'testCase',
  'testNightly'
])

// Why: these came after `build-web.v1`; an older server announces only what it serves.
const NEWER_METHODS: { methods: ReadonlySet<Method>; capability: string; refusal: () => string }[] =
  [
    {
      methods: STAND_METHODS,
      capability: BUILD_WEB_STANDS_RUNTIME_CAPABILITY,
      refusal: () =>
        translate(
          'buildWeb.client.updateServerStands',
          'This Orca server does not support Stands yet. Update the server to use them.'
        )
    },
    {
      methods: TEST_HISTORY_METHODS,
      capability: BUILD_WEB_TEST_HISTORY_RUNTIME_CAPABILITY,
      refusal: () =>
        translate(
          'buildWeb.client.updateServerTestHistory',
          'This Orca server does not support Test history yet. Update the server to use it.'
        )
    },
    {
      methods: new Set<Method>(['issueFile']),
      capability: BUILD_WEB_ISSUE_FILES_RUNTIME_CAPABILITY,
      refusal: () =>
        translate(
          'buildWeb.client.updateServerIssueFiles',
          'This Orca server does not open task attachments yet. Update the server.'
        )
    },
    {
      methods: new Set<Method>(['issueMockupView']),
      capability: BUILD_WEB_ISSUE_MOCKUPS_RUNTIME_CAPABILITY,
      refusal: () =>
        translate(
          'buildWeb.client.updateServerIssueMockups',
          'This Orca server does not show task artifacts yet. Update the server.'
        )
    },
    {
      methods: new Set<Method>(['adoptImageSuccess']),
      capability: BUILD_WEB_IMAGE_ADOPT_RUNTIME_CAPABILITY,
      refusal: () =>
        translate(
          'buildWeb.client.updateServerImageAdopt',
          'This Orca server cannot settle a failed image with an earlier build yet. Update the server.'
        )
    },
    {
      methods: new Set<Method>(['startImageGroupBuild']),
      capability: BUILD_WEB_IMAGE_GROUP_BUILD_RUNTIME_CAPABILITY,
      refusal: () =>
        translate(
          'buildWeb.client.updateServerImageGroupBuild',
          'This Orca server cannot build several images at once yet. Update the server.'
        )
    },
    {
      methods: new Set<Method>(['imageFreshness']),
      capability: BUILD_WEB_IMAGE_FRESHNESS_RUNTIME_CAPABILITY,
      refusal: () =>
        translate(
          'buildWeb.client.updateServerImageFreshness',
          'This Orca server cannot tell which images need a rebuild yet. Update the server.'
        )
    },
    {
      methods: new Set<Method>(['standHealth']),
      capability: BUILD_WEB_STAND_HEALTH_RUNTIME_CAPABILITY,
      refusal: () =>
        translate(
          'buildWeb.client.updateServerStandHealth',
          'This Orca server does not monitor the stands yet. Update the server.'
        )
    },
    {
      methods: new Set<Method>(['archiveIssue', 'restoreIssue']),
      capability: BUILD_WEB_ISSUE_ARCHIVE_RUNTIME_CAPABILITY,
      refusal: () =>
        translate(
          'buildWeb.client.updateServerArchive',
          'This Orca server cannot archive tasks yet. Update the server.'
        )
    },
    {
      methods: new Set<Method>(['trainsRolling']),
      capability: BUILD_WEB_TRAINS_ROLLING_RUNTIME_CAPABILITY,
      refusal: () =>
        translate(
          'buildWeb.client.updateServerTrainsRolling',
          'This Orca server does not count the images trains roll out yet. Update the server.'
        )
    },
    {
      methods: new Set<Method>(['activity', 'notificationsSeen', 'notificationsClear']),
      capability: BUILD_WEB_ACTIVITY_RUNTIME_CAPABILITY,
      refusal: () =>
        translate(
          'buildWeb.client.updateServerActivity',
          'This Orca server does not read build-web notifications and tasks yet. Update the server.'
        )
    },
    {
      methods: new Set<Method>(['savedQueries', 'saveQuery', 'deleteQuery']),
      capability: BUILD_WEB_SAVED_QUERIES_RUNTIME_CAPABILITY,
      refusal: () =>
        translate(
          'buildWeb.client.updateServerSavedQueries',
          'This Orca server does not keep saved queries yet. Update the server.'
        )
    }
  ]

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
