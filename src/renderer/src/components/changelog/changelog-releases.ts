// The custom builds' changelog as orca-release writes it (config/scripts/custom-changelog.mjs).

export type ChangelogRelease = {
  /** `<base>-custom.<stamp>`: every build of this release has a version that starts with it. */
  version: string
  /** `YYYY-MM-DD`. */
  date: string
  /** The last source commit the entry covers. */
  commit: string
  note: string | null
  features: string[]
  settings: string[]
  fixes: string[]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const textsOf = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
    : []

/** The releases in the file, newest first; an entry without a version or date is skipped. */
export function changelogReleasesOf(raw: unknown): ChangelogRelease[] {
  const releases = isRecord(raw) && Array.isArray(raw.releases) ? raw.releases : []
  return releases.filter(isRecord).flatMap((r) =>
    typeof r.version === 'string' && r.version && typeof r.date === 'string' && r.date
      ? [
          {
            version: r.version,
            date: r.date,
            commit: typeof r.commit === 'string' ? r.commit : '',
            note: typeof r.note === 'string' && r.note.trim() ? r.note : null,
            features: textsOf(r.features),
            settings: textsOf(r.settings),
            fixes: textsOf(r.fixes)
          }
        ]
      : []
  )
}

/** `1.4.230` out of `1.4.230-custom.1792399999999`. */
export const releaseBaseVersion = (version: string): string => version.split('-')[0]

/** The app's version is `<release version>.<commit>` for a build of that release. */
export const isInstalledRelease = (release: ChangelogRelease, appVersion: string | null): boolean =>
  appVersion !== null && appVersion.startsWith(`${release.version}.`)

/** A `YYYY-MM-DD` day in the viewer's locale; anything else as it is. */
export function releaseDateLabel(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  return m
    ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    : date
}
