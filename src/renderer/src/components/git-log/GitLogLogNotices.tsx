import React from 'react'
import { translate } from '@/i18n/i18n'
import { GIT_LOG_PAGE_MAX_LOADED } from '../../../../shared/git-log-page-types'
import type { GitLogRows } from './use-git-log-data'

/** The lines above the log: a reload error, the commit cap, a host that lists only HEAD. */
export function GitLogLogNotices({
  page,
  error
}: {
  page: GitLogRows | null
  /** Shown only while older rows stay on screen; an empty log says it in its place. */
  error: string | null
}): React.JSX.Element {
  return (
    <>
      {error ? (
        <div className="shrink-0 border-b px-3 py-1.5 text-xs text-destructive">{error}</div>
      ) : null}
      {page?.capped ? (
        <div className="shrink-0 border-b px-3 py-1.5 text-xs text-muted-foreground">
          {translate(
            'gitLog.table.capped',
            'Showing the first {{value0}} commits. Narrow the filters to reach older ones.',
            { value0: GIT_LOG_PAGE_MAX_LOADED.toLocaleString() }
          )}
        </div>
      ) : null}
      {page?.headOnly ? (
        <div className="shrink-0 border-b px-3 py-1.5 text-xs text-muted-foreground">
          {page.headOnly === 'outdated-app'
            ? translate(
                'gitLog.table.restartApp',
                'Showing only the current branch: Orca was updated while running. Restart Orca to see all branches.'
              )
            : page.headOnly === 'ssh'
              ? translate(
                  'gitLog.table.ssh',
                  'Showing only the current branch, read-only: the Git page can’t read all branches of a project on an SSH host yet.'
                )
              : translate(
                  'gitLog.table.headOnly',
                  'This Orca server shows only the current branch. Update it to see all branches.'
                )}
        </div>
      ) : null}
    </>
  )
}
