import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { CreateFromPicker } from '@/components/repo/CreateFromPicker'
import { getRuntimeRepoBaseRefDefault } from '@/runtime/runtime-repo-client'
import { useRepoMap, useWorktreesForRepo } from '@/store/selectors'
import { translate } from '@/i18n/i18n'
import type { Repo } from '../../../../shared/repo-types'
import { getRepoExecutionHostId } from '../../../../shared/execution-host'

export type NewWorktreeDraft = { repoId: string; name: string; baseBranch: string }

/** The branch a new worktree of the repo starts from: the project's own default, else git's. */
function useDefaultBaseRef(repo: Repo | undefined): string | null {
  const [resolved, setResolved] = useState<{ repoId: string; ref: string | null } | null>(null)
  const repoId = repo?.id
  const hostId = repo ? getRepoExecutionHostId(repo) : undefined
  useEffect(() => {
    if (!repoId || !hostId) {
      return
    }
    let stale = false
    void getRuntimeRepoBaseRefDefault(hostId, repoId).then(
      (result) => !stale && setResolved({ repoId, ref: result.defaultBaseRef }),
      () => !stale && setResolved({ repoId, ref: null })
    )
    return () => {
      stale = true
    }
  }, [hostId, repoId])
  return repo?.worktreeBaseRef ?? (resolved && resolved.repoId === repoId ? resolved.ref : null)
}

/** Where the batch's own worktree goes: the repository, its name and the branch it starts from. */
export function TakeToWorkNewWorktree({
  repos,
  draft,
  onChange
}: {
  repos: Repo[]
  draft: NewWorktreeDraft
  onChange: (draft: NewWorktreeDraft) => void
}): React.JSX.Element {
  const repoMap = useRepoMap()
  const repoWorktrees = useWorktreesForRepo(draft.repoId || null)
  const defaultBaseRef = useDefaultBaseRef(repoMap.get(draft.repoId))
  // Why: the base is always a named branch, never "whatever the default is" left blank.
  useEffect(() => {
    if (!draft.baseBranch && defaultBaseRef) {
      onChange({ ...draft, baseBranch: defaultBaseRef })
    }
  }, [defaultBaseRef, draft, onChange])
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="take-new-repo">{translate('buildWeb.take.repo', 'Repository')}</Label>
        <Select
          value={draft.repoId}
          // A repo's branches are its own: its default is picked again.
          onValueChange={(repoId) => onChange({ ...draft, repoId, baseBranch: '' })}
        >
          <SelectTrigger id="take-new-repo" className="w-full">
            <SelectValue placeholder={translate('buildWeb.take.pickRepo', 'Pick a repository')} />
          </SelectTrigger>
          <SelectContent>
            {repos.map((repo) => (
              <SelectItem key={repo.id} value={repo.id}>
                {repo.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="take-new-name">{translate('buildWeb.take.name', 'Name')}</Label>
          <Input
            id="take-new-name"
            value={draft.name}
            onChange={(event) => onChange({ ...draft, name: event.target.value })}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label>{translate('buildWeb.take.base', 'Base branch')}</Label>
          {draft.repoId ? (
            <CreateFromPicker
              key={draft.repoId}
              repoId={draft.repoId}
              repoMap={repoMap}
              worktrees={repoWorktrees}
              // Why: the picker marks its default entry for '', while the draft names the branch.
              value={draft.baseBranch === defaultBaseRef ? '' : draft.baseBranch}
              onValueChange={(branch) =>
                onChange({ ...draft, baseBranch: branch || defaultBaseRef || '' })
              }
            />
          ) : null}
        </div>
      </div>
      {draft.repoId && !draft.baseBranch && defaultBaseRef === null ? (
        <p className="text-xs text-muted-foreground">
          {translate('buildWeb.take.pickBase', 'Pick the branch the worktree starts from.')}
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        {translate(
          'buildWeb.take.newHint',
          'Orca creates the worktree, then the session works in it (-no-worktree).'
        )}
      </p>
    </div>
  )
}
