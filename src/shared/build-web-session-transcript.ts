import { resolveNativeChatTranscriptAgent } from './native-chat-agent-support'

// A task session's agent log (IS-147), read through the host that ran it: the log never leaves the
// host as a file, only as bounded pages of readable text.

/** Messages per page, each clipped, so a page stays well inside one remote RPC frame. */
export const SESSION_TRANSCRIPT_PAGE_MESSAGES = 80
export const SESSION_TRANSCRIPT_MESSAGE_CHARS = 3000

/** Claude's own default for `cleanupPeriodDays`: logs older than this are deleted. */
export const CLAUDE_DEFAULT_LOG_RETENTION_DAYS = 30

export type BuildWebSessionTranscript =
  | {
      kind: 'found'
      /** The page's messages, oldest first, as `[role] text` blocks. */
      text: string
      /** Pass as `before` for the page before this one; null at the start of the log. */
      before: number | null
    }
  /**
   * No log on the host: the agent deleted it, or it never wrote one here. `retentionDays` is
   * Claude's own and comes only for a Claude session; an older host sends it for every agent.
   */
  | { kind: 'missing'; retentionDays?: number }
  | { kind: 'unsupported' }

type TranscriptSession = {
  agent: string
  started_at: string
  agent_finished_at?: string | null
  ended_at?: string | null
}

/** Whether the log was last written long enough ago for Claude to have deleted it by now. */
export function transcriptLikelyDeleted(
  lastWrittenAt: string,
  retentionDays: number,
  now: number
): boolean {
  const written = Date.parse(lastWrittenAt)
  return Number.isFinite(written) && now - written > retentionDays * 24 * 60 * 60 * 1000
}

/**
 * Why there is no log, worded once for both clients; `days` fills the label's `{{days}}`. Claude
 * deletes a log by when it was last written, so the age runs from the session's end.
 */
export function missingTranscriptLabel(
  session: TranscriptSession,
  retentionDays: number | undefined,
  now: number
): { key: string; text: string; days: number } {
  const lastWrittenAt = session.ended_at ?? session.agent_finished_at ?? session.started_at
  return resolveNativeChatTranscriptAgent(session.agent) === 'claude' &&
    retentionDays !== undefined &&
    transcriptLikelyDeleted(lastWrittenAt, retentionDays, now)
    ? {
        key: 'buildWeb.session.logDeleted',
        text: 'The log was deleted: Claude keeps session logs for {{days}} days.',
        days: retentionDays
      }
    : {
        key: 'buildWeb.session.logMissing',
        text: 'This host has no log for this session.',
        days: 0
      }
}

export const UNSUPPORTED_TRANSCRIPT_LABEL = {
  key: 'buildWeb.session.logUnsupported',
  text: 'Orca cannot read this agent’s log.'
}
