import { useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import type { BuildWebIssueRow } from '../../../../src/shared/build-web-types'
import { BottomDrawer } from '../../components/BottomDrawer'
import { LoadingSpinner } from '../../components/LoadingSpinner'
import { MobileSegmentedControl } from '../../components/MobileSegmentedControl'
import { MobileSwitch } from '../../components/MobileSwitch'
import { useRouteHandoff } from '../../navigation/route-handoff'
import { colors, radii, spacing, typography } from '../../theme/mobile-theme'
import { useBuildWebScreen } from '../build-web-screen-context'
import { BuildWebToneChip, ProductChip, StatusChip } from '../BuildWebToneChip'
import { CardButton, ErrorText, MutedText, ui } from '../issue/issue-card-ui'
import { launchBuildWebTask } from './build-web-agent-launch'
import { createTaskWorktree } from './build-web-new-worktree'
import {
  batchCheckMessage,
  defaultTakeToWorkWorktree,
  isChatPlatformBatch,
  lastTakeToWorkWorktree,
  MAX_INSTRUCTION,
  rememberTakeToWorkWorktree,
  takeToWorkCandidates,
  takeToWorkPrompt,
  takeToWorkRepos,
  takenWorktreeNames,
  taskWorktreeName,
  taskWorktreeTitle,
  validateBuildWebBatch,
  type TakeToWorkWorktree
} from './build-web-take-to-work'
import { taskSessionName } from '../../../../src/shared/build-web-task-session-name'
import { TakeToWorkField, TakeToWorkInput } from './TakeToWorkFormParts'
import { TakeToWorkNewWorktree, type NewWorktreeDraft } from './TakeToWorkNewWorktree'
import { TakeToWorkAgentPicker } from './TakeToWorkAgentPicker'
import { TakeToWorkWorktreePicker } from './TakeToWorkWorktreePicker'
import { useClaudeLaunchAccounts } from './use-claude-launch-accounts'
import { useHostClaudeArgs } from './use-host-claude-args'
import {
  AGENT_LAUNCH_UPDATE_REQUIRED_MESSAGE,
  supportsMobileExistingAgentLaunch
} from '../../session/mobile-existing-agent-launch'
import { useTakeToWorkHost } from './use-take-to-work-host'
import { BUILD_WEB_WORKTREE_TASK_RUNTIME_CAPABILITY } from '../../../../src/shared/build-web-capability'

const SETUP_CHOICES = [
  { value: 'inherit', label: 'Repo default' },
  { value: 'run', label: 'Run setup' },
  { value: 'skip', label: 'Skip setup' }
] as const

/** Make the task's own worktree (a `cp` task: pick one), and start a Claude session there with only the skill call. */
export function BuildWebTakeToWorkSheet({
  issues,
  onClose
}: {
  issues: BuildWebIssueRow[] | null
  onClose: () => void
}) {
  const open = issues !== null && issues.length > 0
  return (
    <BottomDrawer visible={open} onClose={onClose} fillAvailable>
      {open ? <TakeToWorkForm issues={issues} onClose={onClose} /> : null}
    </BottomDrawer>
  )
}

// Why a separate form: it mounts per opening, so its state starts from the defaults of that moment.
function TakeToWorkForm({ issues, onClose }: { issues: BuildWebIssueRow[]; onClose: () => void }) {
  const screen = useBuildWebScreen()
  const { client, hostId, hostCapabilities, status, call, notify } = screen
  const router = useRouteHandoff()
  const { height } = useWindowDimensions()
  const { host, reload } = useTakeToWorkHost(client)
  const ready = host.kind === 'ready'
  const repos = useMemo(() => (host.kind === 'ready' ? host.repos : []), [host])
  const all = useMemo(() => (host.kind === 'ready' ? host.worktrees : []), [host])
  const { worktrees, matchedRepo } = useMemo(() => takeToWorkCandidates(repos, all), [all, repos])
  const ownRepos = useMemo(() => takeToWorkRepos(repos).repos, [repos])
  const repoNames = useMemo(() => new Map(repos.map((r) => [r.id, r.displayName])), [repos])
  const [picked, setPicked] = useState<string | null>(null)
  const worktreeId =
    picked ?? defaultTakeToWorkWorktree(worktrees, null, lastTakeToWorkWorktree(hostId))
  const [auto, setAuto] = useState(false)
  const [instruction, setInstruction] = useState('')
  const issue = issues[0]
  // Why: a `cp` task's session runs in a monorepo worktree, and the skill makes chat-platform's itself.
  const chatPlatform = isChatPlatformBatch(issues)
  const flags = { auto, ownWorktree: chatPlatform, instruction }
  const [draft, setDraft] = useState<NewWorktreeDraft | null>(null)
  const defaultRepoId = ownRepos[0]?.id ?? ''
  const shownDraft: NewWorktreeDraft = draft ?? {
    repoId: defaultRepoId,
    name: taskWorktreeName(
      issue.key,
      takenWorktreeNames(all.filter((w) => w.repoId === defaultRepoId))
    ),
    baseBranch: ''
  }
  const [starting, setStarting] = useState(false)
  const [setupDecision, setSetupDecision] = useState<'inherit' | 'run' | 'skip'>('inherit')
  // A worktree this sheet made whose session did not start: Start retries in it, never makes another.
  const [created, setCreated] = useState<{ worktreeId: string; name: string } | null>(null)
  // The agent may be running: no second launch until the person has looked at the workspace.
  const [unconfirmed, setUnconfirmed] = useState<{
    message: string
    worktreeId: string
    name: string
  } | null>(null)
  const launchSupported = supportsMobileExistingAgentLaunch(hostCapabilities)
  const hostClaudeArgs = useHostClaudeArgs(client)
  const targetRepoId = chatPlatform
    ? (worktrees.find((w) => w.worktreeId === worktreeId)?.repoId ?? '')
    : shownDraft.repoId
  // Why: over SSH or in WSL the session keeps its own login, so another account cannot be named.
  const ownLogin = repos.find((r) => r.id === targetRepoId)?.ownLogin === true
  const offeredAccounts = useClaudeLaunchAccounts(client, hostCapabilities)
  const accounts = ownLogin ? [] : offeredAccounts
  const [pickedAccountId, setPickedAccountId] = useState<string | undefined>(undefined)
  // Why: an account the host no longer offers would fail the pane, so it falls back to the selection.
  const claudeAccountId = accounts.some((a) => a.id === pickedAccountId)
    ? pickedAccountId
    : undefined
  const check = validateBuildWebBatch(issues)
  const held = issue.agent_session
  const worktree = worktrees.find((w) => w.worktreeId === worktreeId) ?? null
  const prompt = check.ok ? takeToWorkPrompt(issue.key, flags) : ''
  const baseUrl = status.baseUrl

  const targetReady =
    created !== null ||
    (chatPlatform
      ? Boolean(worktree)
      : Boolean(shownDraft.repoId && shownDraft.name.trim() && shownDraft.baseBranch.trim()))
  const canStart =
    !starting &&
    launchSupported &&
    unconfirmed === null &&
    check.ok &&
    Boolean(baseUrl) &&
    targetReady

  const openSession = (id: string, name: string, paneKey?: string) => {
    const pane = paneKey ? `&paneKey=${encodeURIComponent(paneKey)}` : ''
    router.push(
      `/h/${encodeURIComponent(hostId)}/session/${encodeURIComponent(id)}?name=${encodeURIComponent(name)}${pane}`
    )
  }

  const launchIn = async (
    target: Pick<TakeToWorkWorktree, 'worktreeId' | 'displayName' | 'hostId'>
  ) => {
    if (!baseUrl) {
      return
    }
    const result = await launchBuildWebTask({
      client,
      hostCapabilities,
      call,
      baseUrl,
      worktree: target,
      issue,
      flags,
      hostClaudeArgs,
      ...(claudeAccountId ? { claudeAccountId } : {})
    })
    switch (result.kind) {
      case 'failed':
        notify(result.message, 'error')
        return
      case 'unconfirmed':
        setUnconfirmed({
          message: result.message,
          worktreeId: target.worktreeId,
          name: target.displayName
        })
        return
      case 'started':
        rememberTakeToWorkWorktree(hostId, result.worktreeId)
        notify(
          result.warning ?? `Agent started in ${target.displayName}`,
          result.warning ? 'info' : 'success'
        )
        onClose()
        openSession(result.worktreeId, target.displayName, result.paneKey)
    }
  }

  const start = async () => {
    if (!canStart) {
      return
    }
    setStarting(true)
    try {
      if (created) {
        await launchIn({ worktreeId: created.worktreeId, displayName: created.name })
        return
      }
      if (!chatPlatform) {
        const name = shownDraft.name.trim()
        notify(`Creating the worktree ${name}…`)
        const made = await createTaskWorktree({
          client,
          repoId: shownDraft.repoId,
          name,
          baseBranch: shownDraft.baseBranch,
          displayName: taskWorktreeTitle(issue),
          setupDecision,
          // Why gated: an older host strips the field, and then nothing would say it was dropped.
          ...(baseUrl && hostCapabilities.includes(BUILD_WEB_WORKTREE_TASK_RUNTIME_CAPABILITY)
            ? { buildWebTask: { issueId: issue.id, key: issue.key, consoleHost: baseUrl } }
            : {})
        })
        if ('error' in made) {
          notify(made.error, 'error')
          return
        }
        setCreated({ worktreeId: made.worktreeId, name: made.name })
        notify(`Starting the session in ${made.name}…`)
        await launchIn({ worktreeId: made.worktreeId, displayName: made.name })
        return
      }
      if (worktree) {
        await launchIn(worktree)
      }
    } finally {
      setStarting(false)
    }
  }

  return (
    <ScrollView
      style={{ maxHeight: height * 0.85 }}
      contentContainerStyle={styles.form}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Take {issue.key} to work</Text>
      <MutedText>
        {chatPlatform
          ? 'A new Claude session in the worktree gets only the build-web-tasks skill call.'
          : 'Orca makes a worktree for this task and starts a Claude session there with only the build-web-tasks skill call.'}
      </MutedText>
      <View style={styles.tasks}>
        {issues.map((i) => (
          <View key={i.id} style={ui.row}>
            <Text style={styles.key}>{i.key}</Text>
            <Text style={styles.taskTitle} numberOfLines={1}>
              {i.title}
            </Text>
            <StatusChip status={i.status} />
          </View>
        ))}
        <View style={ui.row}>
          <ProductChip product={issue.product} />
          <BuildWebToneChip
            label={issue.version_name ?? 'No release'}
            tone={null}
            mono={Boolean(issue.version_name)}
          />
        </View>
      </View>
      {batchCheckMessage(check) ? <ErrorText>{batchCheckMessage(check)}</ErrorText> : null}
      {host.kind === 'loading' ? <LoadingSpinner size={16} color={colors.textMuted} /> : null}
      {host.kind === 'error' ? (
        <View style={ui.row}>
          <ErrorText>{host.message}</ErrorText>
          <CardButton label="Retry" onPress={reload} />
        </View>
      ) : null}
      {ready ? (
        <TakeToWorkField label="Worktree">
          {chatPlatform ? (
            <>
              {worktrees.length ? (
                <TakeToWorkWorktreePicker
                  worktrees={worktrees}
                  repoNames={repoNames}
                  value={worktreeId}
                  onChange={setPicked}
                />
              ) : (
                <MutedText>This host has no worktree to start in.</MutedText>
              )}
              <MutedText>
                {matchedRepo
                  ? 'Worktrees of sa-dc-ap-products. The skill must be up to date in the one you pick.'
                  : 'No sa-dc-ap-products repository found; showing every git worktree.'}{' '}
                Chat Platform tasks: the session runs in this monorepo worktree, and the skill makes
                the chat-platform worktree itself, beside its clone.
              </MutedText>
            </>
          ) : (
            <>
              <TakeToWorkNewWorktree
                client={client}
                repos={ownRepos}
                draft={shownDraft}
                onChange={setDraft}
              />
              <TakeToWorkField label="Setup script">
                <MobileSegmentedControl
                  segments={SETUP_CHOICES}
                  selected={setupDecision}
                  onSelect={setSetupDecision}
                  fill
                />
              </TakeToWorkField>
            </>
          )}
        </TakeToWorkField>
      ) : null}
      <TakeToWorkAgentPicker
        accounts={accounts}
        value={claudeAccountId}
        onChange={setPickedAccountId}
      />
      <Text style={ui.body}>
        <Text style={styles.muted}>Session: </Text>
        {taskSessionName(issues)}
      </Text>
      <View style={styles.switchRow}>
        <View style={styles.switchText}>
          <Text style={ui.body}>Auto mode</Text>
          <MutedText>No stop after the plans; only tasks handed to AI</MutedText>
        </View>
        <MobileSwitch value={auto} onValueChange={setAuto} accessibilityLabel="Auto mode" />
      </View>
      <TakeToWorkField label="Additional instruction">
        <TakeToWorkInput
          value={instruction}
          onChangeText={setInstruction}
          maxLength={MAX_INSTRUCTION}
          multiline
          placeholder="Optional: passed to the session after the skill call"
          accessibilityLabel="Additional instruction"
        />
      </TakeToWorkField>
      {held ? (
        <MutedText>
          A session in {held.worktree_name} holds this task. The new session takes it over, and that
          one ends as replaced.
        </MutedText>
      ) : null}
      {prompt ? (
        <Text style={styles.prompt} selectable>
          {prompt}
        </Text>
      ) : null}
      {launchSupported ? null : <ErrorText>{AGENT_LAUNCH_UPDATE_REQUIRED_MESSAGE}</ErrorText>}
      {created && !unconfirmed ? (
        <MutedText>
          The worktree {created.name} is made; Start session tries the session in it again.
        </MutedText>
      ) : null}
      {unconfirmed ? (
        <View style={styles.unconfirmed}>
          <ErrorText>{unconfirmed.message}</ErrorText>
          <CardButton
            label={`Open ${unconfirmed.name}`}
            onPress={() => {
              onClose()
              openSession(unconfirmed.worktreeId, unconfirmed.name)
            }}
          />
        </View>
      ) : null}
      <View style={ui.saveRow}>
        <CardButton variant="ghost" label="Cancel" onPress={onClose} />
        <CardButton
          variant="primary"
          label={starting ? 'Starting…' : 'Start session'}
          disabled={!canStart}
          onPress={() => void start()}
        />
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  form: { gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  title: { color: colors.textPrimary, fontSize: 16, fontWeight: '600' },
  tasks: {
    gap: spacing.xs + 2,
    padding: spacing.md,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.borderSubtle
  },
  key: {
    width: 84,
    color: colors.textMuted,
    fontFamily: typography.monoFamily,
    fontSize: typography.metaSize
  },
  taskTitle: { flex: 1, minWidth: 0, color: colors.textPrimary, fontSize: typography.bodySize },
  muted: { color: colors.textMuted },
  unconfirmed: { gap: spacing.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  switchText: { flex: 1, gap: 2 },
  prompt: {
    color: colors.textSecondary,
    fontFamily: typography.monoFamily,
    fontSize: 11,
    padding: spacing.md,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: colors.borderSubtle
  }
})
