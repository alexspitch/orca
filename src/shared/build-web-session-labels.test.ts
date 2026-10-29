import { describe, expect, it } from 'vitest'
import { fillSessionLabel, sessionAttentionPhrases } from './build-web-session-labels'

function words(args: Parameters<typeof sessionAttentionPhrases>[0]) {
  const phrases = sessionAttentionPhrases(args)
  return phrases && { full: fillSessionLabel(phrases.full), short: fillSessionLabel(phrases.short) }
}

describe('sessionAttentionPhrases', () => {
  it('counts the commits a branch has outside its base, by the base branch name', () => {
    expect(words({ reason: 'commits', detail: '2', baseRef: 'origin/master' })).toEqual({
      full: '2 commits not in master',
      short: '2 commits'
    })
    expect(words({ reason: 'commits', detail: '1', baseRef: 'refs/remotes/origin/main' })).toEqual({
      full: '1 commit not in main',
      short: '1 commit'
    })
    expect(words({ reason: 'commits', detail: '3' })?.full).toBe('3 unmerged commits')
    expect(words({ reason: 'commits' })?.full).toBe('Unmerged commits')
  })

  it('names what a detail-carrying reason found, and nothing for a reason it does not know', () => {
    expect(words({ reason: 'head-moved', detail: 'hotfix' })?.full).toBe('Switched to hotfix')
    expect(words({ reason: 'agent-running' })?.full).toBe('Agent still running 24 h after Done')
    expect(sessionAttentionPhrases({ reason: 'a-newer-hosts-reason' })).toBeNull()
  })
})
