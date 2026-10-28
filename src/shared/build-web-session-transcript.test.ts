import { describe, expect, it } from 'vitest'
import { missingTranscriptLabel } from './build-web-session-transcript'

const DAY = 24 * 60 * 60 * 1000
const now = Date.parse('2026-10-28T10:00:00Z')
const ago = (days: number): string => new Date(now - days * DAY).toISOString()

describe('why a session has no log', () => {
  it('blames Claude’s retention only for a Claude log last written longer ago than it', () => {
    const longRun = { agent: 'claude', started_at: ago(40), ended_at: ago(2) }
    expect(missingTranscriptLabel(longRun, 30, now).key).toBe('buildWeb.session.logMissing')
    const old = { agent: 'claude', started_at: ago(40), agent_finished_at: ago(35) }
    expect(missingTranscriptLabel(old, 30, now)).toMatchObject({
      key: 'buildWeb.session.logDeleted',
      days: 30
    })
    const codex = { agent: 'codex', started_at: ago(40) }
    expect(missingTranscriptLabel(codex, 30, now).key).toBe('buildWeb.session.logMissing')
  })
})
