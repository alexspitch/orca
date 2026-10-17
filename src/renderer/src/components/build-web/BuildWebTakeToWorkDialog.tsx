import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { WorkspaceCombobox } from '@/components/automations/WorkspaceCombobox'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import type { BuildWebIssueRow } from '../../../../shared/build-web-types'
import { useBuildWebStore } from './build-web-store'
import { useBuildWebTarget } from './use-build-web-data'
import {
  buildWebBatchPrompt,
  defaultTakeToWorkWorktree,
  takeToWorkCandidates,
  batchCheckMessage,
  validateBuildWebBatch
} from './build-web-take-to-work'
import { launchBuildWebBatch } from './build-web-agent-launch'
import { productLabel } from './build-web-labels'

function Option({
  checked,
  onChange,
  title,
  hint
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  title: string
  hint: string
}): React.JSX.Element {
  return (
    <label className="flex items-start gap-2 text-sm">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      <span>
        {title}
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </label>
  )
}

// Why a separate form: it mounts per opening, so its state starts from the defaults of that moment.
function TakeToWorkForm({
  issues,
  onClose
}: {
  issues: BuildWebIssueRow[]
  onClose: () => void
}): React.JSX.Element {
  const { target } = useBuildWebTarget()
  const repos = useAppStore((s) => s.repos)
  const worktreesByRepo = useAppStore((s) => s.worktreesByRepo)
  const baseUrl = useBuildWebStore((s) => s.status?.baseUrl ?? null)
  const remember = useBuildWebStore((s) => s.rememberTakeToWork)
  const { worktrees, matchedRepo } = useMemo(
    () => takeToWorkCandidates(repos, worktreesByRepo),
    [repos, worktreesByRepo]
  )
  const [worktreeId, setWorktreeId] = useState(() =>
    defaultTakeToWorkWorktree(
      worktrees,
      useAppStore.getState().activeWorktreeId,
      useBuildWebStore.getState().lastWorktreeId
    )
  )
  const [noWorktree, setNoWorktree] = useState(() => useBuildWebStore.getState().noWorktree)
  const [auto, setAuto] = useState(false)
  const check = validateBuildWebBatch(issues)
  const held = issues.filter((i) => i.agent_session)
  const worktree = worktrees.find((w) => w.id === worktreeId) ?? null
  const prompt = check.ok
    ? buildWebBatchPrompt(
        issues.map((i) => i.key),
        { noWorktree, auto }
      )
    : ''

  const start = (): void => {
    if (!worktree || !check.ok || !baseUrl) {
      return
    }
    remember(worktree.id, noWorktree)
    onClose()
    void launchBuildWebBatch({ target, baseUrl, worktree, issues, flags: { noWorktree, auto } })
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {translate('buildWeb.take.title', 'Take to work ({{count}})', {
            count: issues.length
          })}
        </DialogTitle>
        <DialogDescription>
          {translate(
            'buildWeb.take.description',
            'A new Claude session in an existing worktree gets only the build-web-tasks skill call.'
          )}
        </DialogDescription>
      </DialogHeader>
      <ul className="flex flex-col gap-1 rounded-md border border-border p-3 text-sm">
        {issues.map((i) => (
          <li key={i.id} className="flex gap-2">
            <span className="w-20 shrink-0 font-mono text-xs text-muted-foreground">{i.key}</span>
            <span className="truncate">{i.title}</span>
          </li>
        ))}
        <li className="pt-1 text-xs text-muted-foreground">
          {productLabel(issues[0].product)} ·{' '}
          {issues[0].version_name ?? translate('buildWeb.detail.noRelease', 'No release')}
        </li>
      </ul>
      {batchCheckMessage(check) ? (
        <p role="alert" className="text-sm text-destructive">
          {batchCheckMessage(check)}
        </p>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">
          {translate('buildWeb.take.worktree', 'Worktree')}
        </span>
        <WorkspaceCombobox
          worktrees={worktrees}
          value={worktreeId ?? ''}
          onValueChange={setWorktreeId}
        />
        <p className="text-xs text-muted-foreground">
          {matchedRepo
            ? translate(
                'buildWeb.take.worktreeHint',
                'Worktrees of sa-dc-ap-products. The skill must be up to date in the one you pick.'
              )
            : translate(
                'buildWeb.take.noRepo',
                'No sa-dc-ap-products repository found; showing every git worktree.'
              )}
        </p>
      </div>
      <p className="text-sm">
        <span className="text-muted-foreground">{translate('buildWeb.take.agent', 'Agent')}: </span>
        {translate('buildWeb.take.claude', 'Claude Code')}
      </p>
      <div className="flex flex-col gap-2">
        <Option
          checked={noWorktree}
          onChange={setNoWorktree}
          title={translate('buildWeb.take.noWorktree', 'Work in this worktree')}
          hint={translate(
            'buildWeb.take.noWorktreeHint',
            'The skill does not create its own worktree'
          )}
        />
        <Option
          checked={auto}
          onChange={setAuto}
          title={translate('buildWeb.take.auto', 'Auto mode')}
          hint={translate(
            'buildWeb.take.autoHint',
            'No stop after the plans; only tasks handed to AI'
          )}
        />
      </div>
      {held.length ? (
        <p className="text-xs text-muted-foreground">
          {translate(
            'buildWeb.take.held',
            'Already held by a session: {{list}}. Starting replaces it.',
            {
              list: held.map((i) => `${i.key} (${i.agent_session?.worktree_name})`).join(', ')
            }
          )}
        </p>
      ) : null}
      {prompt ? (
        <code className="block rounded-md border border-border px-3 py-2 font-mono text-xs">
          {prompt}
        </code>
      ) : null}
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          {translate('buildWeb.take.cancel', 'Cancel')}
        </Button>
        <Button disabled={!check.ok || !worktree} onClick={start}>
          {translate('buildWeb.take.start', 'Start session')}
        </Button>
      </DialogFooter>
    </>
  )
}

/** Pick an existing worktree and start a Claude session there with only the skill call. */
export function BuildWebTakeToWorkDialog({
  issues,
  onClose
}: {
  issues: BuildWebIssueRow[] | null
  onClose: () => void
}): React.JSX.Element {
  return (
    <Dialog open={issues !== null && issues.length > 0} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-lg">
        {issues && issues.length > 0 ? <TakeToWorkForm issues={issues} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  )
}
