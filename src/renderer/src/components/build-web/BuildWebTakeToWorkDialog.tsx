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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { WorkspaceCombobox } from '@/components/automations/WorkspaceCombobox'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import type { BuildWebIssueRow } from '../../../../shared/build-web-types'
import { useBuildWebStore } from './build-web-store'
import { useBuildWebTarget } from './use-build-web-data'
import {
  batchWorktreeName,
  buildWebBatchPrompt,
  defaultTakeToWorkWorktree,
  takeToWorkCandidates,
  takeToWorkRepos,
  batchCheckMessage,
  validateBuildWebBatch
} from './build-web-take-to-work'
import { launchBuildWebBatch } from './build-web-agent-launch'
import { taskSessionName } from './build-web-task-session'
import { createBatchWorktree } from './build-web-new-worktree'
import { TakeToWorkNewWorktree, type NewWorktreeDraft } from './TakeToWorkNewWorktree'
import { BuildWebToneChip, ProductChip, StatusChip } from './BuildWebToneChip'

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
      <Checkbox emphasis="strong" checked={checked} onCheckedChange={(v) => onChange(v === true)} />
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
  const [mode, setMode] = useState<'existing' | 'new'>(() =>
    worktrees.length ? 'existing' : 'new'
  )
  const ownRepos = useMemo(() => takeToWorkRepos(repos).repos, [repos])
  const [draft, setDraft] = useState<NewWorktreeDraft>(() => ({
    repoId: ownRepos[0]?.id ?? '',
    name: batchWorktreeName(issues.map((i) => i.key)),
    baseBranch: ''
  }))
  // Why: a worktree made for the batch is where the session works; the skill must not make another.
  const workHere = mode === 'new' || noWorktree
  const check = validateBuildWebBatch(issues)
  const held = issues.filter((i) => i.agent_session)
  const worktree = worktrees.find((w) => w.id === worktreeId) ?? null
  const prompt = check.ok
    ? buildWebBatchPrompt(
        issues.map((i) => i.key),
        { noWorktree: workHere, auto }
      )
    : ''

  const ready =
    check.ok &&
    Boolean(baseUrl) &&
    (mode === 'new' ? Boolean(draft.repoId && draft.name.trim()) : Boolean(worktree))
  const start = (): void => {
    if (!check.ok || !baseUrl) {
      return
    }
    if (mode === 'new') {
      if (!draft.repoId || !draft.name.trim()) {
        return
      }
      onClose()
      void (async () => {
        const created = await createBatchWorktree({ ...draft, name: draft.name.trim() })
        if (created) {
          remember(created.id, noWorktree)
          await launchBuildWebBatch({
            target,
            baseUrl,
            worktree: created,
            issues,
            flags: { noWorktree: true, auto }
          })
        }
      })()
      return
    }
    if (!worktree) {
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
            'A new Claude session in the worktree gets only the build-web-tasks skill call.'
          )}
        </DialogDescription>
      </DialogHeader>
      <ul className="flex flex-col gap-1 rounded-md border border-border p-3 text-sm">
        {issues.map((i) => (
          <li key={i.id} className="flex items-center gap-2">
            <span className="w-20 shrink-0 font-mono text-xs text-muted-foreground">{i.key}</span>
            <span className="min-w-0 flex-1 truncate">{i.title}</span>
            <StatusChip status={i.status} />
          </li>
        ))}
        <li className="flex items-center gap-1.5 pt-1">
          <ProductChip product={issues[0].product} />
          <BuildWebToneChip
            label={issues[0].version_name ?? translate('buildWeb.detail.noRelease', 'No release')}
            tone={null}
            mono={Boolean(issues[0].version_name)}
          />
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
        <Tabs value={mode} onValueChange={(next) => setMode(next === 'new' ? 'new' : 'existing')}>
          <TabsList>
            <TabsTrigger value="existing" disabled={!worktrees.length}>
              {translate('buildWeb.take.existing', 'Existing worktree')}
            </TabsTrigger>
            <TabsTrigger value="new">
              {translate('buildWeb.take.createNew', 'Create a new worktree')}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {mode === 'new' ? (
        <TakeToWorkNewWorktree repos={ownRepos} draft={draft} onChange={setDraft} />
      ) : (
        <div className="flex flex-col gap-1.5">
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
      )}
      <p className="text-sm">
        <span className="text-muted-foreground">{translate('buildWeb.take.agent', 'Agent')}: </span>
        {translate('buildWeb.take.claude', 'Claude Code')}
      </p>
      <p className="text-sm">
        <span className="text-muted-foreground">
          {translate('buildWeb.take.session', 'Session')}:{' '}
        </span>
        <span className="font-mono text-xs">{taskSessionName(issues.map((i) => i.key))}</span>
      </p>
      <div className="flex flex-col gap-2">
        {mode === 'existing' ? (
          <Option
            checked={noWorktree}
            onChange={setNoWorktree}
            title={translate('buildWeb.take.noWorktree', 'Work in this worktree')}
            hint={translate(
              'buildWeb.take.noWorktreeHint',
              'The skill does not create its own worktree'
            )}
          />
        ) : null}
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
        <Button disabled={!ready} onClick={start}>
          {translate('buildWeb.take.start', 'Start session')}
        </Button>
      </DialogFooter>
    </>
  )
}

/** Pick an existing worktree or make one, and start a Claude session there with only the skill call. */
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
