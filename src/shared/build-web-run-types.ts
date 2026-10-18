// A task's build in build-web, and its guide and commits, as Orca's full-screen card shows them.

/** A piece of a build log from `offset`; `next` is where the following read starts. */
export type BuildWebLogPiece = { text: string; next: number; done: boolean }

export type BuildWebRunBuild = {
  image: string
  dist: string
  branch: string
  /** build-web's raw status: pending, queued, building, SUCCESS, FAILURE, ABORTED, … */
  status: string
  number: number | null
  url: string | null
  tags: string[]
  pushed: boolean
  /** Pushed with the moving main tag too (build-web: pushed and not `main_tag_skipped`). */
  main_tag_pushed: boolean
  /** Published under the build tag only: the moving tag points at a newer image. */
  main_tag_skipped: boolean
  /** Which moving tags that push left alone, and why. */
  skipped_tags: { ref: string; reason: string }[]
  /** When the build was triggered; present from `queued` on. */
  started_at: string | null
  tests_skipped: boolean
  error: string | null
}

export type BuildWebRun = {
  id: string
  /** created | pending | building | success | failed | partial */
  status: string
  branch: string
  ticket: string | null
  dist_type: string
  error: string | null
  user: string
  created_at: string
  testing_status: string
  guide_markdown: string | null
  guide_updated_at: string | null
  jira_action: string | null
  jira_url: string | null
  /** The stand and the UI account the guide's screenshots are taken from. */
  shot_stand_id: string | null
  shot_account_id: string | null
  /** The task the run belongs to; null for a run made outside a task. */
  issue_id: string | null
  builds: BuildWebRunBuild[]
}

export type BuildWebCommit = {
  sha: string
  subject: string
  author: string
  date: string
  branches: string[]
}

export type BuildWebCommitList = { branches: string[]; commits: BuildWebCommit[] }

export type BuildWebCommitDiff = { diff: string; truncated: boolean }

/** A guide screenshot, read with the token in main and handed over as bytes for a blob URL. */
export type BuildWebGuideShot = { mime: string; base64: string }

// Building from a task's «Build» tab, after build-web's Progress and IssueNewBuild.

export type BuildWebCombo = { image: string; dist: string; branch: string }

/** What a build publishes once it lands: nothing, its build tag, or every tag (main tag too). */
export const BUILD_WEB_PUSH_AFTER = ['none', 'build-tag', 'all'] as const
export type BuildWebPushAfter = (typeof BUILD_WEB_PUSH_AFTER)[number]

/** Where a task is headed after its build; decides what a train publishes. */
export const BUILD_WEB_TESTING_STATUSES = ['Testing', 'TESTING_EXTERNAL', 'Done'] as const
export type BuildWebTestingStatus = (typeof BUILD_WEB_TESTING_STATUSES)[number]

export type BuildWebBranch = { name: string; fromTree: boolean }

export type BuildWebLastBuilt = {
  image: string
  dist: string
  branch: string
  state: 'up-to-date' | 'changed' | 'never-built' | 'no-image' | 'unknown'
  build_number: number | null
  built_at: string | null
  /** The CI build tag the entry names. */
  ref: string | null
  published: boolean | null
  changed: string[]
}

export type BuildWebFreshnessRef = {
  branch: string
  kind: string
  commit: string
  date: string
  subject: string
}

export type BuildWebFreshnessState = 'current' | 'stale' | 'unknown'

export type BuildWebBuildFreshness = {
  /** image|dist|branch */
  key: string
  state: BuildWebFreshnessState
  built_at: string | null
  built_from: 'build-tag' | 'triggered' | null
  /** The reference commit's date — what `state` compared the build against. */
  ref_at: string | null
  /** A later CI build the registry does not serve: publishing it may be all that is missing. */
  newer_unpublished: {
    build_number: number
    at: string | null
    state: BuildWebFreshnessState
  } | null
}

export type BuildWebFreshness = {
  refs: BuildWebFreshnessRef[]
  builds: BuildWebBuildFreshness[]
  registry_error: string | null
  /** Present when rows moved onto a newer published image. */
  run: BuildWebRun | null
}

/** What `POST /api/detect` found for a task on a branch. */
export type BuildWebDetect = {
  branch: string
  ticket: string | null
  commit_count: number
  images: string[]
  image_sources: Record<string, string[]>
  suggested_images: string[]
  suggested_image_sources: Record<string, string[]>
  ignored_shared: string[]
  plugins_changed: string[]
  /** The console's own answer, sent back as is when the run is made. */
  raw: Record<string, unknown>
}

export type BuildWebAdoptResult = { run: BuildWebRun | null; reason: string | null }

/** A task's first build: the images on its release branch, the rest each on its own branch. */
export type BuildWebIssueRunArgs = {
  issueId: string
  ticket: string
  branch: string
  images: string[]
  extra: BuildWebCombo[]
  testingStatus: BuildWebTestingStatus
  detected: Record<string, unknown> | null
}
