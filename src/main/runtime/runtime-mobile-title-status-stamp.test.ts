import { describe, expect, it } from 'vitest'
import type { AgentStatusEntry } from '../../shared/agent-status-types'
import { renewRuntimeMobileAgentStatusFromPtyTitle } from './runtime-mobile-agent-status-projection'
import { makeTuiIdlePty } from './tui-idle-wait-test-harness'

// Claude 2.1.312 keeps one glyph-less title for the session; its OSC 7501 done lands just after the
// Stop hook and reclassifies that old title. A paired client keeps whichever row is newer.
describe('a title-only status after program activity reclassifies an old title', () => {
  it('is stamped no earlier than the reclassification, so it outranks the working row before it', () => {
    const stopAt = Date.now() - 5_000
    const doneHook: AgentStatusEntry = {
      state: 'done',
      prompt: 'status',
      updatedAt: stopAt,
      stateStartedAt: stopAt,
      agentType: 'claude',
      mainAgent: { state: 'done', stateStartedAt: stopAt },
      paneKey: 'tab-1:leaf-1',
      stateHistory: []
    }
    const titledLongBefore = makeTuiIdlePty({
      worktreeId: 'wt-1',
      lastOscTitle: 'minimal-stand-service-startup',
      lastOscTitleEpochMs: stopAt - 10 * 60_000,
      lastAgentStatus: 'idle',
      lastAgentStatusStartedAtEpochMs: stopAt + 32,
      lastAgentStatusRichInvalidatedAtEpochMs: stopAt + 32
    })

    const out = renewRuntimeMobileAgentStatusFromPtyTitle(doneHook, titledLongBefore)

    expect(out?.state).toBe('done')
    expect(out?.updatedAt).toBe(stopAt + 32)
  })
})
