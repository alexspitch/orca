import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { translate } from '@/i18n/i18n'
import type { Repo } from '../../../../shared/repo-types'

export type NewWorktreeDraft = { repoId: string; name: string; baseBranch: string }

/** Where the batch's own worktree goes: the repository, its name and what it branches from. */
export function TakeToWorkNewWorktree({
  repos,
  draft,
  onChange
}: {
  repos: Repo[]
  draft: NewWorktreeDraft
  onChange: (draft: NewWorktreeDraft) => void
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="take-new-repo">{translate('buildWeb.take.repo', 'Repository')}</Label>
        <Select value={draft.repoId} onValueChange={(repoId) => onChange({ ...draft, repoId })}>
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
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="take-new-name">{translate('buildWeb.take.name', 'Name')}</Label>
          <Input
            id="take-new-name"
            value={draft.name}
            onChange={(event) => onChange({ ...draft, name: event.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="take-new-base">{translate('buildWeb.take.base', 'Base branch')}</Label>
          <Input
            id="take-new-base"
            value={draft.baseBranch}
            placeholder={translate('buildWeb.take.baseDefault', 'Repository default')}
            onChange={(event) => onChange({ ...draft, baseBranch: event.target.value })}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {translate(
          'buildWeb.take.newHint',
          'Orca creates the worktree, then the session works in it (-no-worktree).'
        )}
      </p>
    </div>
  )
}
