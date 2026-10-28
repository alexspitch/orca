import { useMemo, useState } from 'react'
import { toast } from 'sonner'
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
import { Textarea } from '@/components/ui/textarea'
import { WorkspaceCombobox } from '@/components/automations/WorkspaceCombobox'
import { useAppStore } from '@/store'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import { translate } from '@/i18n/i18n'
import type { BuildWebIssueRow } from '../../../../shared/build-web-types'
import { useBuildWebStore } from './build-web-store'
import { useBuildWebTarget } from './use-build-web-data'
import {
  MAX_INSTRUCTION,
  isChatPlatformBatch,
  defaultTakeToWorkWorktree,
  takeToWorkCandidates,
  takeToWorkPrompt,
  takeToWorkRepos,
  takenWorktreeNames,
  taskWorktreeName,
  batchCheckMessage,
  validateBuildWebBatch
} from './build-web-take-to-work'
import { launchBuildWebTask } from './build-web-agent-launch'
import { taskSessionName } from './build-web-task-session'
import { createTaskWorktree } from './build-web-new-worktree'
import { TakeToWorkNewWorktree, type NewWorktreeDraft } from './TakeToWorkNewWorktree'
import { BuildWebToneChip, ProductChip, StatusChip } from './BuildWebToneChip'
import { TakeToWorkAgentPicker } from './TakeToWorkAgentPicker'
import { useClaudeLaunchAccounts } from '../tab-bar/use-claude-launch-accounts'

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
  const worktreesByRepo = useAppStore(selectWorktreesByRepo)
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
  const [auto, setAuto] = useState(false)
  const [instruction, setInstruction] = useState('')
  const issue = issues[0]
  // Why: a `cp` task's session runs in a monorepo worktree, and the skill makes chat-platform's itself.
  const chatPlatform = isChatPlatformBatch(issues)
  const flags = { auto, ownWorktree: chatPlatform, instruction }
  const ownRepos = useMemo(() => takeToWorkRepos(repos).repos, [repos])
  const [draft, setDraft] = useState<NewWorktreeDraft>(() => {
    const repoId = ownRepos[0]?.id ?? ''
    return {
      repoId,
      name: taskWorktreeName(issue.key, takenWorktreeNames(worktreesByRepo[repoId] ?? [])),
      baseBranch: ''
    }
  })
  // Why a worktree of the picked repo for a new one: it runs on the host the new one will.
  const hostWorktreeId = chatPlatform
    ? (worktreeId ?? undefined)
    : worktreesByRepo[draft.repoId]?.[0]?.id
  const accounts = useClaudeLaunchAccounts(hostWorktreeId ?? '', Boolean(hostWorktreeId))
  const [pickedAccountId, setPickedAccountId] = useState<string | undefined>(undefined)
  // Why: an account of a host no longer picked would fail the pane, so it falls back to the selection.
  const claudeAccountId = accounts.some((a) => a.id === pickedAccountId)
    ? pickedAccountId
    : undefined
  const account = claudeAccountId ? { claudeAccountId } : {}
  const check = validateBuildWebBatch(issues)
  const held = issue.agent_session
  const worktree = worktrees.find((w) => w.id === worktreeId) ?? null
  const prompt = check.ok ? takeToWorkPrompt(issue.key, flags) : ''

  const ready =
    check.ok &&
    Boolean(baseUrl) &&
    (chatPlatform
      ? Boolean(worktree)
      : Boolean(draft.repoId && draft.name.trim() && draft.baseBranch.trim()))
  const start = (): void => {
    if (!check.ok || !baseUrl) {
      return
    }
    if (!chatPlatform) {
      if (!draft.repoId || !draft.name.trim() || !draft.baseBranch.trim()) {
        return
      }
      const name = draft.name.trim()
      onClose()
      void (async () => {
        // Why a toast: the dialog is gone, and creating plus the setup script can take a while.
        const pending = toast.loading(
          translate('buildWeb.take.creating', 'Creating the worktree {{name}}…', { name })
        )
        try {
          const created = await createTaskWorktree({
            ...draft,
            name,
            buildWebTask: { issueId: issue.id, key: issue.key, consoleHost: baseUrl }
          })
          if (created) {
            toast.loading(
              translate('buildWeb.take.starting', 'Starting the session in {{name}}…', { name }),
              { id: pending }
            )
            await launchBuildWebTask({
              target,
              baseUrl,
              worktree: created,
              issue,
              flags,
              ...account
            })
          }
        } finally {
          toast.dismiss(pending)
        }
      })()
      return
    }
    if (!worktree) {
      return
    }
    remember(worktree.id)
    onClose()
    void launchBuildWebTask({ target, baseUrl, worktree, issue, flags, ...account })
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {translate('buildWeb.take.titleOne', 'Take {{key}} to work', { key: issue.key })}
        </DialogTitle>
        <DialogDescription>
          {chatPlatform
            ? translate(
                'buildWeb.take.description',
                'A new Claude session in the worktree gets only the build-web-tasks skill call.'
              )
            : translate(
                'buildWeb.take.descriptionNew',
                'Orca makes a worktree for this task and starts a Claude session there with only the build-web-tasks skill call.'
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
          <ProductChip product={issue.product} />
          <BuildWebToneChip
            label={issue.version_name ?? translate('buildWeb.detail.noRelease', 'No release')}
            tone={null}
            mono={Boolean(issue.version_name)}
          />
        </li>
      </ul>
      {batchCheckMessage(check) ? (
        <p role="alert" className="text-sm text-destructive">
          {batchCheckMessage(check)}
        </p>
      ) : null}
      {chatPlatform ? (
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
                )}{' '}
            {translate(
              'buildWeb.take.chatPlatformWorktree',
              'Chat Platform tasks: the session runs in this monorepo worktree, and the skill makes the chat-platform worktree itself, beside its clone.'
            )}
          </p>
        </div>
      ) : (
        <TakeToWorkNewWorktree repos={ownRepos} draft={draft} onChange={setDraft} />
      )}
      <TakeToWorkAgentPicker
        accounts={accounts}
        value={claudeAccountId}
        onChange={setPickedAccountId}
      />
      <p className="text-sm">
        <span className="text-muted-foreground">
          {translate('buildWeb.take.session', 'Session')}:{' '}
        </span>
        <span className="text-xs">{taskSessionName(issues)}</span>
      </p>
      <div className="flex flex-col gap-2">
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
      <label className="flex flex-col gap-1 text-sm">
        {translate('buildWeb.take.instruction', 'Additional instruction')}
        <Textarea
          value={instruction}
          maxLength={MAX_INSTRUCTION}
          rows={3}
          onChange={(event) => setInstruction(event.target.value)}
          placeholder={translate(
            'buildWeb.take.instructionHint',
            'Optional: passed to the session after the skill call'
          )}
        />
      </label>
      {held ? (
        <p className="text-xs text-muted-foreground">
          {translate(
            'buildWeb.take.heldOne',
            'A session in {{worktree}} holds this task. The new session takes it over, and that one ends as replaced.',
            { worktree: held.worktree_name }
          )}
        </p>
      ) : null}
      {prompt ? (
        <code className="scrollbar-sleek block max-h-40 overflow-auto rounded-md border border-border px-3 py-2 font-mono text-xs whitespace-pre-wrap">
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

/** Make the task's own worktree (a `cp` task: pick one), and start a Claude session there with only the skill call. */
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
