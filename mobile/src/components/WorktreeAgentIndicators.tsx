import { FlaskConical, SquareTerminal } from 'lucide-react-native'
import { StyleSheet, Text, View } from 'react-native'
import type { RuntimeWorktreeAgentRow } from '../../../src/shared/runtime-types'
import {
  isTestRunCommand,
  normalizeAgentBackgroundCommandsField,
  type AgentBackgroundCommand
} from '../../../src/shared/agent-background-commands'
import { colors } from '../theme/mobile-theme'
import { formatTimeAgo } from '../worktree/agent-row-display'

/** The agent's background commands, read defensively: hosts update independently of the phone. */
export function agentBackgroundCommands(agent: RuntimeWorktreeAgentRow): AgentBackgroundCommand[] {
  return normalizeAgentBackgroundCommandsField(agent.backgroundCommands) ?? []
}

export function BackgroundCommandIcon({
  commands,
  size
}: {
  commands: readonly AgentBackgroundCommand[]
  size: number
}) {
  const Icon = commands.some(isTestRunCommand) ? FlaskConical : SquareTerminal
  return <Icon size={size} color={colors.textSecondary} />
}

/** A command the agent above left running in the background, as on the desktop's opened row. */
export function WorktreeBackgroundCommandRow({
  command,
  depth,
  now
}: {
  command: AgentBackgroundCommand
  depth: number
  now: number
}) {
  return (
    <View style={[styles.commandRow, { paddingLeft: 18 + depth * 14 }]}>
      <BackgroundCommandIcon commands={[command]} size={11} />
      <Text style={styles.commandText} numberOfLines={1}>
        {command.description}
      </Text>
      <Text style={styles.commandAge}>{formatTimeAgo(command.startedAt, now)}</Text>
    </View>
  )
}

/**
 * A workspace's agent facts at the end of its title line, as on the desktop: what its agents run
 * in the background, then how many agents run, from two on. The host lists only agents in live
 * panes, so every row counts.
 */
export function WorktreeAgentIndicators({ agents }: { agents: RuntimeWorktreeAgentRow[] }) {
  const commands = agents.flatMap(agentBackgroundCommands)
  if (agents.length < 2 && commands.length === 0) {
    return null
  }
  return (
    <>
      {commands.length > 0 ? (
        <View
          accessibilityLabel={
            commands.some(isTestRunCommand) ? 'Tests running' : 'Background command'
          }
        >
          <BackgroundCommandIcon commands={commands} size={12} />
        </View>
      ) : null}
      {agents.length > 1 ? (
        <View style={styles.circle} accessibilityLabel={`${agents.length} agents running`}>
          <Text style={styles.text}>{agents.length}</Text>
        </View>
      ) : null}
    </>
  )
}

const styles = StyleSheet.create({
  circle: {
    flexShrink: 0,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgRaised
  },
  text: {
    fontSize: 10,
    lineHeight: 12,
    color: colors.textSecondary,
    fontVariant: ['tabular-nums']
  },
  commandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 18
  },
  commandText: {
    flexShrink: 1,
    fontSize: 12,
    color: colors.textSecondary
  },
  commandAge: {
    flexShrink: 0,
    fontSize: 11,
    color: colors.textMuted
  }
})
