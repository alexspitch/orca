import React from 'react'
import { EllipsisVertical, Minus } from 'lucide-react'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  GitLogPicker,
  gitLogPickerSearchLabels,
  type GitLogPickerOption
} from './GitLogProjectPicker'
import type { GitLogSelectionState } from './use-git-log-selection'

function branchName(branch: string | null | undefined): string | undefined {
  return branch ? branch.replace(/^refs\/heads\//, '') : undefined
}

/** WebStorm's tool-window strip: "Git", the Log tab, then this page's project / worktree pick. */
export function GitLogHeader({
  selection,
  onClose
}: {
  selection: GitLogSelectionState
  onClose: () => void
}): React.JSX.Element {
  const defaultRepoId = useAppStore((s) => s.settings?.gitLogDefaultRepoId ?? null)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const labels = gitLogPickerSearchLabels()
  const defaultBadge = translate('gitLog.picker.default', 'default')

  const projectOptions: GitLogPickerOption[] = selection.repos.map((repo) => ({
    id: repo.id,
    label: repo.displayName,
    detail: repo.path,
    badge: repo.id === defaultRepoId ? defaultBadge : undefined
  }))
  const worktreeOptions: GitLogPickerOption[] = selection.worktrees.map((worktree) => ({
    id: worktree.id,
    label: worktree.displayName,
    detail: branchName(worktree.branch) ?? worktree.path,
    badge: worktree.isMainWorktree ? translate('gitLog.picker.main', 'main checkout') : undefined
  }))
  const project = projectOptions.find((option) => option.id === selection.repo?.id) ?? null
  const worktree = worktreeOptions.find((option) => option.id === selection.worktree?.id) ?? null
  const isDefault = selection.repo !== null && selection.repo.id === defaultRepoId

  return (
    <header
      className="flex h-9 shrink-0 items-center gap-1 border-b pl-3"
      // Why: no stacked titlebar on this page; keep the header clear of the window controls.
      style={{ paddingRight: 'max(0.5rem, var(--window-controls-width, 0px))' }}
    >
      <h1 className="mr-2 text-[13px] font-semibold">{translate('gitLog.title', 'Git')}</h1>
      <div role="tablist" className="flex h-full items-stretch">
        <span
          role="tab"
          aria-selected="true"
          className="flex items-center px-2.5 text-[13px] shadow-[inset_0_-2px_0_var(--foreground)]"
        >
          {translate('gitLog.tab.log', 'Log')}
        </span>
      </div>
      <div className="mx-2 h-4 w-px bg-border" />
      <GitLogPicker
        value={project}
        options={projectOptions}
        placeholder={translate('gitLog.picker.project', 'Project')}
        searchLabel={labels.project}
        emptyLabel={labels.empty}
        onPick={selection.pickRepo}
      />
      <span className="text-muted-foreground">/</span>
      <GitLogPicker
        value={worktree}
        options={worktreeOptions}
        placeholder={translate('gitLog.picker.worktree', 'Worktree')}
        searchLabel={labels.worktree}
        emptyLabel={labels.empty}
        onPick={selection.pickWorktree}
      />
      <div className="flex-1" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={translate('gitLog.header.options', 'Options')}
          >
            <EllipsisVertical className="size-3.5 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuItem
            disabled={!selection.repo}
            onSelect={() =>
              void updateSettings({
                gitLogDefaultRepoId: isDefault ? null : (selection.repo?.id ?? null)
              })
            }
          >
            {isDefault
              ? translate('gitLog.header.clearDefault', 'Stop Opening This Project by Default')
              : translate('gitLog.header.setDefault', 'Open This Project by Default')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={translate('gitLog.header.hide', 'Hide')}
            onClick={onClose}
          >
            <Minus className="size-3.5 text-muted-foreground" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={4}>
          {translate('gitLog.header.hide', 'Hide')}
        </TooltipContent>
      </Tooltip>
    </header>
  )
}
