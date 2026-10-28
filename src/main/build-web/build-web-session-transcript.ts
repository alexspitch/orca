import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { resolveSessionFilePath } from '../native-chat/session-file-resolver'
import {
  nativeChatLineDecoderForAgent,
  readNativeChatTranscriptTailFile
} from '../native-chat/transcript-tail-reader'
import { claudeProjectsHostDirs } from '../ai-vault/session-scanner-roots'
import { isENOENT } from '../ipc/filesystem/filesystem-path-containment'
import { resolveNativeChatTranscriptAgent } from '../../shared/native-chat-agent-support'
import { formatWorkerTranscriptMessage } from '../../shared/worker-transcript-text'
import {
  CLAUDE_DEFAULT_LOG_RETENTION_DAYS,
  SESSION_TRANSCRIPT_MESSAGE_CHARS,
  SESSION_TRANSCRIPT_PAGE_MESSAGES,
  type BuildWebSessionTranscript
} from '../../shared/build-web-session-transcript'

// A task session's log (IS-147), found by the agent's own session id under the same roots the AI
// vault scans, and handed out as bounded pages of text from its end.

export type SessionTranscriptLocations = {
  /** Claude's projects folder to search instead of this host's own (tests). */
  claudeProjectsDir?: string
}

const clip = (text: string): string =>
  text.length <= SESSION_TRANSCRIPT_MESSAGE_CHARS
    ? text
    : `${text.slice(0, SESSION_TRANSCRIPT_MESSAGE_CHARS)}\n… (clipped)`

/** Claude's `cleanupPeriodDays` beside its projects folder, else its default. */
async function claudeLogRetentionDays(projectsDir: string | undefined): Promise<number> {
  if (!projectsDir) {
    return CLAUDE_DEFAULT_LOG_RETENTION_DAYS
  }
  try {
    const settings: unknown = JSON.parse(
      await readFile(join(dirname(projectsDir), 'settings.json'), 'utf8')
    )
    const days =
      typeof settings === 'object' && settings !== null && 'cleanupPeriodDays' in settings
        ? settings.cleanupPeriodDays
        : undefined
    return typeof days === 'number' && days > 0 ? days : CLAUDE_DEFAULT_LOG_RETENTION_DAYS
  } catch {
    return CLAUDE_DEFAULT_LOG_RETENTION_DAYS
  }
}

export async function readBuildWebSessionTranscript(
  args: { agent: string; providerSessionId: string; before?: number },
  locations: SessionTranscriptLocations = {}
): Promise<BuildWebSessionTranscript> {
  const decode = nativeChatLineDecoderForAgent(args.agent)
  if (!decode) {
    return { kind: 'unsupported' }
  }
  const missing = async (): Promise<BuildWebSessionTranscript> => ({
    kind: 'missing',
    retentionDays:
      resolveNativeChatTranscriptAgent(args.agent) === 'claude'
        ? await claudeLogRetentionDays(locations.claudeProjectsDir ?? claudeProjectsHostDirs()[0])
        : CLAUDE_DEFAULT_LOG_RETENTION_DAYS
  })
  const filePath = await resolveSessionFilePath(
    args.agent,
    args.providerSessionId,
    locations.claudeProjectsDir ? { claudeProjectsDir: locations.claudeProjectsDir } : {}
  ).catch(() => null)
  if (!filePath) {
    return missing()
  }
  let page: Awaited<ReturnType<typeof readNativeChatTranscriptTailFile>>
  try {
    page = await readNativeChatTranscriptTailFile(
      filePath,
      SESSION_TRANSCRIPT_PAGE_MESSAGES,
      decode,
      true,
      args.before
    )
  } catch (error) {
    // Why: the agent may delete the log between finding and reading it.
    if (isENOENT(error)) {
      return missing()
    }
    throw error
  }
  return {
    kind: 'found',
    text: page.messages.map((message) => clip(formatWorkerTranscriptMessage(message))).join('\n\n'),
    before: page.hasMore ? page.beforeOffset : null
  }
}
