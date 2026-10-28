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
  /** No log on the host: the agent deleted it after `retentionDays`, or it never wrote one here. */
  | { kind: 'missing'; retentionDays: number }
  | { kind: 'unsupported' }

/** Whether a session started long enough ago for its agent to have deleted the log by now. */
export function transcriptLikelyDeleted(
  startedAt: string,
  retentionDays: number,
  now: number
): boolean {
  const started = Date.parse(startedAt)
  return Number.isFinite(started) && now - started > retentionDays * 24 * 60 * 60 * 1000
}

/** Why there is no log, worded once for both clients; `{{days}}` is the host's retention. */
export function missingTranscriptLabel(
  retentionDays: number,
  startedAt: string,
  now: number
): { key: string; text: string } {
  return transcriptLikelyDeleted(startedAt, retentionDays, now)
    ? {
        key: 'buildWeb.session.logDeleted',
        text: 'The log was deleted: Claude keeps session logs for {{days}} days.'
      }
    : { key: 'buildWeb.session.logMissing', text: 'This host has no log for this session.' }
}

export const UNSUPPORTED_TRANSCRIPT_LABEL = {
  key: 'buildWeb.session.logUnsupported',
  text: 'Orca cannot read this agent’s log.'
}
