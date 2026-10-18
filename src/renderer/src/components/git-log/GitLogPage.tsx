import React from 'react'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { useBuildWebPageEscape } from '../build-web/use-build-web-page-escape'
import { GitLogHeader } from './GitLogHeader'
import { GitLogWorkspace } from './GitLogWorkspace'
import { useGitLogSelection } from './use-git-log-selection'

function emptyMessage(hasRepos: boolean, hasWorktree: boolean): string {
  if (!hasRepos) {
    return translate('gitLog.empty.noProjects', 'Add a Git project to see its log.')
  }
  return hasWorktree
    ? translate('gitLog.empty.unreachable', "This project's host can't be reached from here.")
    : translate('gitLog.empty.noWorktrees', 'This project has no worktrees loaded yet.')
}

/** The «Git» page: a project's log across all branches, laid out as WebStorm's Git › Log. */
export default function GitLogPage(): React.JSX.Element {
  const closePage = useAppStore((s) => s.closeGitLogPage)
  useBuildWebPageEscape(closePage)
  const selection = useGitLogSelection()
  const { repo, worktree, context } = selection

  return (
    <main className="relative flex h-full min-h-0 flex-1 flex-col bg-background pt-5 text-foreground md:pt-6">
      <GitLogHeader selection={selection} onClose={closePage} />
      {repo && worktree && context ? (
        // Why keyed by project: filters, selection and tree state belong to one repository.
        <GitLogWorkspace
          key={repo.id}
          worktree={worktree}
          worktrees={selection.worktrees}
          onPickWorktree={selection.pickWorktree}
          context={context}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center px-6 text-sm text-muted-foreground">
          {emptyMessage(selection.repos.length > 0, worktree !== null)}
        </div>
      )}
    </main>
  )
}
