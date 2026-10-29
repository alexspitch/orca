/** A runtime that serves the `buildWeb.*` RPC namespace — the Issues page asks before calling it. */
export const BUILD_WEB_RUNTIME_CAPABILITY = 'build-web.v1'

/** A runtime that serves the «Stands» page's `buildWeb.stand*` methods. */
export const BUILD_WEB_STANDS_RUNTIME_CAPABILITY = 'build-web-stands.v1'

/** A runtime that monitors every stand at once: `buildWeb.standHealth`. */
export const BUILD_WEB_STAND_HEALTH_RUNTIME_CAPABILITY = 'build-web-stand-health.v1'

/** A runtime that serves Testing's «Test history» tab: `buildWeb.test*` and test-job logs. */
export const BUILD_WEB_TEST_HISTORY_RUNTIME_CAPABILITY = 'build-web-test-history.v1'

/** A runtime that counts the images trains are rolling out, for the Trains item. */
export const BUILD_WEB_TRAINS_ROLLING_RUNTIME_CAPABILITY = 'build-web-trains-rolling.v1'

/** A runtime that reads build-web's bell and task list for the titlebar: `buildWeb.activity`. */
export const BUILD_WEB_ACTIVITY_RUNTIME_CAPABILITY = 'build-web-activity.v1'

/** A runtime that serves a task's attachments: `buildWeb.issueFile`. */
export const BUILD_WEB_ISSUE_FILES_RUNTIME_CAPABILITY = 'build-web-issue-files.v1'

/** A runtime that settles a failed image with its last successful build: `buildWeb.adoptImageSuccess`. */
export const BUILD_WEB_IMAGE_ADOPT_RUNTIME_CAPABILITY = 'build-web-image-adopt.v1'

/** A runtime that names where a task's mockup is shown: `buildWeb.issueMockupView`. */
export const BUILD_WEB_ISSUE_MOCKUPS_RUNTIME_CAPABILITY = 'build-web-issue-mockups.v1'

/** A runtime that knows product `cp` (Chat Platform) and its `repo: 'chat-platform'`; an older one refuses both. */
export const BUILD_WEB_PRODUCT_CP_RUNTIME_CAPABILITY = 'build-web-product-cp.v1'

/** A runtime that archives tasks (`buildWeb.archiveIssue`, `restoreIssue`) and lists the archive. */
export const BUILD_WEB_ISSUE_ARCHIVE_RUNTIME_CAPABILITY = 'build-web-issue-archive.v1'

/** A runtime whose `buildWeb.addComment` takes `telegram`; an older one drops it and keeps the comment in the console. */
export const BUILD_WEB_COMMENT_TELEGRAM_RUNTIME_CAPABILITY = 'build-web-comment-telegram.v1'

/** A runtime that reads and keeps the Issues table's saved filters: `buildWeb.savedQueries`, `saveQuery`, `deleteQuery`. */
export const BUILD_WEB_SAVED_QUERIES_RUNTIME_CAPABILITY = 'build-web-saved-queries.v1'

/** A runtime whose `buildWeb.listIssues` accepts `sort: 'favorite'`; an older one refuses the value. */
export const BUILD_WEB_ISSUE_FAVORITE_SORT_RUNTIME_CAPABILITY = 'build-web-issue-favorite-sort.v1'

/** A runtime that says whether a product version's images hold its branch's changes: `buildWeb.imageFreshness`. */
export const BUILD_WEB_IMAGE_FRESHNESS_RUNTIME_CAPABILITY = 'build-web-image-freshness.v1'

/** A runtime that derives a redos twin again (IS-230): `buildWeb.retryRedosTwin`. */
export const BUILD_WEB_REDOS_TWIN_RUNTIME_CAPABILITY = 'build-web-redos-twin.v1'

/** A runtime that reads the console's `features` (IS-230.21): `buildWeb.consoleFeatures`. */
export const BUILD_WEB_CONSOLE_FEATURES_RUNTIME_CAPABILITY = 'build-web-console-features.v1'

/** A runtime that builds several images in one run: `buildWeb.startImageGroupBuild`. */
/** A runtime that reads the console's page of all tasks (IS-10): `buildWeb.taskPage`. */
export const BUILD_WEB_TASK_PAGE_RUNTIME_CAPABILITY = 'build-web-task-page.v1'

export const BUILD_WEB_IMAGE_GROUP_BUILD_RUNTIME_CAPABILITY = 'build-web-image-group-build.v1'

/**
 * A runtime whose worktrees carry their build-web task and its session state (IS-147):
 * `worktree.create` takes `buildWebTask`, rows carry `buildWebTask`/`buildWebSession`, the
 * `task` grouping and the `buildWeb.agentSession*` methods. Absent means «unknown»: no badge.
 */
export const BUILD_WEB_WORKTREE_TASK_RUNTIME_CAPABILITY = 'build-web-worktree-task.v1'

/** A runtime whose `ui.set` takes `showInputRequiredGroup`, the «By task» Input required switch. */
export const BUILD_WEB_INPUT_REQUIRED_GROUP_RUNTIME_CAPABILITY = 'build-web-input-required-group.v1'

/** A runtime that reads a task session's agent log on its own disk (IS-147): `buildWeb.sessionTranscript`. */
export const BUILD_WEB_SESSION_TRANSCRIPT_RUNTIME_CAPABILITY = 'build-web-session-transcript.v1'
