import {
  BUILD_WEB_ACTIVITY_RUNTIME_CAPABILITY,
  BUILD_WEB_CONSOLE_FEATURES_RUNTIME_CAPABILITY,
  BUILD_WEB_IMAGE_ADOPT_RUNTIME_CAPABILITY,
  BUILD_WEB_IMAGE_FRESHNESS_RUNTIME_CAPABILITY,
  BUILD_WEB_IMAGE_GROUP_BUILD_RUNTIME_CAPABILITY,
  BUILD_WEB_ISSUE_ARCHIVE_RUNTIME_CAPABILITY,
  BUILD_WEB_ISSUE_FILES_RUNTIME_CAPABILITY,
  BUILD_WEB_ISSUE_MOCKUPS_RUNTIME_CAPABILITY,
  BUILD_WEB_REDOS_TWIN_RUNTIME_CAPABILITY,
  BUILD_WEB_SAVED_QUERIES_RUNTIME_CAPABILITY,
  BUILD_WEB_SESSION_TRANSCRIPT_RUNTIME_CAPABILITY,
  BUILD_WEB_STANDS_RUNTIME_CAPABILITY,
  BUILD_WEB_STAND_HEALTH_RUNTIME_CAPABILITY,
  BUILD_WEB_TASK_PAGE_RUNTIME_CAPABILITY,
  BUILD_WEB_TEST_HISTORY_RUNTIME_CAPABILITY,
  BUILD_WEB_TRAINS_ROLLING_RUNTIME_CAPABILITY,
  BUILD_WEB_WORKTREE_TASK_RUNTIME_CAPABILITY
} from '../../../../shared/build-web-capability'
import type { BuildWebApi } from '../../../../preload/api/build-web-api'
import { translate } from '@/i18n/i18n'

type Method = keyof BuildWebApi

// The build-web calls that came after `build-web.v1`, each with the capability a server announces for it.

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

export const NEWER_METHODS: {
  methods: ReadonlySet<Method>
  capability: string
  refusal: () => string
}[] = [
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
    methods: new Set<Method>(['consoleFeatures']),
    capability: BUILD_WEB_CONSOLE_FEATURES_RUNTIME_CAPABILITY,
    refusal: () =>
      translate(
        'buildWeb.client.updateServerConsoleFeatures',
        'This Orca server cannot read what the console supports yet. Update the server.'
      )
  },
  {
    methods: new Set<Method>(['retryRedosTwin']),
    capability: BUILD_WEB_REDOS_TWIN_RUNTIME_CAPABILITY,
    refusal: () =>
      translate(
        'buildWeb.client.updateServerRedosTwin',
        'This Orca server cannot derive a redos image again yet. Update the server.'
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
    methods: new Set<Method>(['taskPage']),
    capability: BUILD_WEB_TASK_PAGE_RUNTIME_CAPABILITY,
    refusal: () =>
      translate(
        'buildWeb.client.updateServerTaskPage',
        'This Orca server does not read the list of all build-web tasks yet. Update the server.'
      )
  },
  {
    methods: new Set<Method>([
      'agentSessionSettings',
      'setAgentSessionSettings',
      'keepWorktreeSession'
    ]),
    capability: BUILD_WEB_WORKTREE_TASK_RUNTIME_CAPABILITY,
    refusal: () =>
      translate(
        'buildWeb.client.updateServerSessions',
        'This Orca server does not follow task sessions yet. Update the server.'
      )
  },
  {
    methods: new Set<Method>(['sessionTranscript']),
    capability: BUILD_WEB_SESSION_TRANSCRIPT_RUNTIME_CAPABILITY,
    refusal: () =>
      translate(
        'buildWeb.client.updateServerTranscript',
        'This Orca server does not hand out session logs yet. Update the server.'
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
