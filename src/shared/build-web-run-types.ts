// A task's build in build-web, and its guide and commits, as Orca's full-screen card shows them.

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
  tests_skipped: boolean
  error: string | null
}

export type BuildWebRun = {
  id: string
  status: string
  branch: string
  user: string
  created_at: string
  testing_status: string
  guide_markdown: string | null
  guide_updated_at: string | null
  jira_action: string | null
  jira_url: string | null
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
