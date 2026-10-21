/** A runtime that serves the `buildWeb.*` RPC namespace — the Issues page asks before calling it. */
export const BUILD_WEB_RUNTIME_CAPABILITY = 'build-web.v1'

/** A runtime that serves the «Stands» page's `buildWeb.stand*` methods. */
export const BUILD_WEB_STANDS_RUNTIME_CAPABILITY = 'build-web-stands.v1'

/** A runtime that serves Testing's «Test history» tab: `buildWeb.test*` and test-job logs. */
export const BUILD_WEB_TEST_HISTORY_RUNTIME_CAPABILITY = 'build-web-test-history.v1'

/** A runtime that counts the images trains are rolling out, for the Trains item. */
export const BUILD_WEB_TRAINS_ROLLING_RUNTIME_CAPABILITY = 'build-web-trains-rolling.v1'

/** A runtime that serves a task's attachments: `buildWeb.issueFile`. */
export const BUILD_WEB_ISSUE_FILES_RUNTIME_CAPABILITY = 'build-web-issue-files.v1'

/** A runtime that settles a failed image with its last successful build: `buildWeb.adoptImageSuccess`. */
export const BUILD_WEB_IMAGE_ADOPT_RUNTIME_CAPABILITY = 'build-web-image-adopt.v1'

/** A runtime that names where a task's mockup is shown: `buildWeb.issueMockupView`. */
export const BUILD_WEB_ISSUE_MOCKUPS_RUNTIME_CAPABILITY = 'build-web-issue-mockups.v1'
