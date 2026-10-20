import { describe, expect, it } from 'vitest'
import { DevServicesStatusSchema } from './dev-services-contract'

describe('DevServicesStatusSchema', () => {
  it('fills the lists a minimal status leaves out', () => {
    expect(DevServicesStatusSchema.parse({ api: 1, ok: true })).toEqual({
      api: 1,
      ok: true,
      profiles: [],
      services: [],
      actions: [],
      others: [],
      problems: []
    })
  })

  it('reads a full status and ignores fields it does not know', () => {
    const status = DevServicesStatusSchema.parse({
      api: 1,
      ok: true,
      futureField: { anything: true },
      worktree: { path: '/srv/wt', slot: 1, label: 'slot 1 · ports +10000' },
      profiles: [{ id: 'dc', title: 'DC', includes: ['common'], services: ['dc-backend'] }],
      services: [
        {
          id: 'dc-backend',
          profile: 'dc',
          state: 'ready',
          ports: [{ port: 18077, url: 'https://tw.spitch-dev.ai:18077/' }],
          extra: 1
        }
      ],
      actions: [{ id: 'calls', label: 'Calls → main', verb: 'calls', args: [] }]
    })

    expect(status).not.toHaveProperty('futureField')
    expect(status.profiles[0]).toMatchObject({ ready: 0, running: 0, total: 0 })
    expect(status.services[0]).toMatchObject({ id: 'dc-backend', state: 'ready' })
    expect(status.actions[0]).toMatchObject({ tone: 'normal', args: [] })
  })

  it('keeps a state this build cannot draw as unknown, never as stopped', () => {
    const status = DevServicesStatusSchema.parse({
      api: 1,
      ok: true,
      services: [{ id: 'x', state: 'hibernating', ports: [] }]
    })

    expect(status.services[0]).toMatchObject({ state: 'unknown', profile: null })
  })

  it('rejects an action whose verb could be mistaken for shell text', () => {
    expect(
      DevServicesStatusSchema.safeParse({
        api: 1,
        ok: true,
        actions: [{ id: 'bad', label: 'Bad', verb: 'start; rm -rf /', args: [] }]
      }).success
    ).toBe(false)
  })
})
