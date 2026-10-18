/** The Git page's settings, kept apart from upstream's settings types. */
export type GitLogSettings = {
  /** The «Git» sidebar item; shown unless set to false. */
  showGitLogButton?: boolean
  /** The project the Git page opens on; unset follows the active workspace. */
  gitLogDefaultRepoId?: string | null
}

export function showsGitLogButton(settings: GitLogSettings | null | undefined): boolean {
  return settings?.showGitLogButton !== false
}
