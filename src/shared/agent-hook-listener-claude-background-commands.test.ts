// Replay real Claude 2.1.287 PTY hooks: the shells the main agent leaves running are named on its row until they end.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { normalizeHookPayload } from './agent-hook-listener'
import { createHookListenerState } from './agent-hook-listener/listener-state'
import { makePaneKey } from './stable-pane-id'

type CapturedRecord = { scenario: string; payload?: Record<string, unknown> }

const PANE_KEY = makePaneKey('tab-1', '11111111-1111-4111-8111-111111111111')
const records: CapturedRecord[] = readFileSync(
  join(__dirname, '__fixtures__', 'claude-task-notification-hooks.jsonl'),
  'utf8'
)
  .split('\n')
  .filter(Boolean)
  .map((line) => JSON.parse(line))

/** The background commands each published row names, in capture order. */
function publishedCommands(scenario: string): { description: string; command?: string }[][] {
  const state = createHookListenerState()
  const published: { description: string; command?: string }[][] = []
  for (const record of records) {
    if (record.scenario !== scenario || !record.payload) {
      continue
    }
    const event = normalizeHookPayload(
      state,
      'claude',
      { paneKey: PANE_KEY, payload: record.payload },
      'production'
    )
    if (event) {
      published.push(
        (event.payload.backgroundCommands ?? []).map(({ description, command }) => ({
          description,
          command
        }))
      )
    }
  }
  return published
}

describe('Claude background commands', () => {
  it('names the shells the main agent left running, until they end', () => {
    const published = publishedCommands('two-shells-together')
    const shell = { description: 'Sleep for 12 seconds', command: 'sleep 12' }
    expect(published).toContainEqual([shell, shell])
    expect(published.at(-1)).toEqual([])
  })

  it('names a Monitor like a shell', () => {
    expect(publishedCommands('monitor-events')).toContainEqual([
      {
        description: 'tick counter (3 ticks, 4s apart)',
        command: 'for i in 1 2 3; do echo tick $i; sleep 4; done'
      }
    ])
  })

  it("does not name a subagent's own shell", () => {
    expect(publishedCommands('subagent-with-own-shell').flat()).toEqual([])
  })
})
