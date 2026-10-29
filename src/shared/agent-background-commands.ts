import { normalizeOptionalField } from './agent-status-field-normalization'

/** A command the main agent left running in the background, named for the sidebar. Display only. */
export type AgentBackgroundCommand = {
  /** The provider's task id. */
  id: string
  /** The agent's own words for the command; the command line when it gave none. */
  description: string
  command?: string
  startedAt: number
}

const AGENT_BACKGROUND_COMMANDS_MAX = 8
const AGENT_BACKGROUND_COMMAND_ID_MAX_LENGTH = 64
const AGENT_BACKGROUND_COMMAND_DESCRIPTION_MAX_LENGTH = 200
const AGENT_BACKGROUND_COMMAND_LINE_MAX_LENGTH = 500

/** A launch's display fields from the tool input that started it; null when it names nothing. */
export function readAgentBackgroundCommandLabel(
  toolInput: unknown,
  startedAt: number
): Omit<AgentBackgroundCommand, 'id'> | null {
  if (typeof toolInput !== 'object' || toolInput === null) {
    return null
  }
  const input: Record<string, unknown> = { ...toolInput }
  const command = normalizeOptionalField(input.command, AGENT_BACKGROUND_COMMAND_LINE_MAX_LENGTH)
  const description =
    normalizeOptionalField(input.description, AGENT_BACKGROUND_COMMAND_DESCRIPTION_MAX_LENGTH) ??
    (command
      ? normalizeOptionalField(command, AGENT_BACKGROUND_COMMAND_DESCRIPTION_MAX_LENGTH)
      : undefined)
  if (!description) {
    return null
  }
  return { description, ...(command ? { command } : {}), startedAt }
}

export function normalizeAgentBackgroundCommandsField(
  value: unknown
): AgentBackgroundCommand[] | undefined {
  if (!Array.isArray(value) || value.length === 0) {
    return undefined
  }
  const commands: AgentBackgroundCommand[] = []
  for (const item of value.slice(0, AGENT_BACKGROUND_COMMANDS_MAX)) {
    if (typeof item !== 'object' || item === null) {
      continue
    }
    const obj: Record<string, unknown> = { ...item }
    const id = normalizeOptionalField(obj.id, AGENT_BACKGROUND_COMMAND_ID_MAX_LENGTH)
    const description = normalizeOptionalField(
      obj.description,
      AGENT_BACKGROUND_COMMAND_DESCRIPTION_MAX_LENGTH
    )
    const command = normalizeOptionalField(obj.command, AGENT_BACKGROUND_COMMAND_LINE_MAX_LENGTH)
    if (!id || !description || typeof obj.startedAt !== 'number') {
      continue
    }
    if (!Number.isFinite(obj.startedAt)) {
      continue
    }
    commands.push({ id, description, ...(command ? { command } : {}), startedAt: obj.startedAt })
  }
  return commands.length > 0 ? commands : undefined
}

export function agentBackgroundCommandsEqual(
  a: readonly AgentBackgroundCommand[] | undefined,
  b: readonly AgentBackgroundCommand[] | undefined
): boolean {
  if (a === b) {
    return true
  }
  if (!a || !b || a.length !== b.length) {
    return !a && !b
  }
  return a.every(
    (x, i) =>
      x.id === b[i].id &&
      x.description === b[i].description &&
      x.command === b[i].command &&
      x.startedAt === b[i].startedAt
  )
}

const TEST_RUN_WORDS = /\b(tests?|testing|vitest|jest|pytest|playwright|cypress|mocha|e2e)\b/i

/** Whether a command looks like a test run. A guess from its words; a miss only drops the flask. */
export function isTestRunCommand(
  command: Pick<AgentBackgroundCommand, 'description' | 'command'>
): boolean {
  return TEST_RUN_WORDS.test(command.command ?? '') || TEST_RUN_WORDS.test(command.description)
}
