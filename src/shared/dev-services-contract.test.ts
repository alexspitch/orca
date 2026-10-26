import { describe, expect, it } from 'vitest'
import { DevServicesRunOutcomeSchema, DevServicesStatusSchema } from './dev-services-contract'

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

describe('a service whose code changed under it', () => {
  const service = (changed: unknown) =>
    DevServicesStatusSchema.parse({
      api: 1,
      ok: true,
      services: [{ id: 'dc-backend', state: 'ready', changed }]
    }).services[0]

  it('keeps what changed, and fills the lists it leaves out', () => {
    expect(
      service({
        since: 1_700_000_000,
        files: ['a.ts'],
        workspaces: ['@sp/api'],
        unbuilt: ['@sp/ui']
      }).changed
    ).toEqual({
      since: 1_700_000_000,
      files: ['a.ts'],
      workspaces: ['@sp/api'],
      unbuilt: ['@sp/ui']
    })
    expect(service({}).changed).toEqual({ files: [], workspaces: [], unbuilt: [] })
  })

  it('drops a shape it does not know, not the service', () => {
    const odd = service('yes')
    expect(odd.id).toBe('dc-backend')
    expect(odd.changed).toBeUndefined()
    expect(service({ files: 'a.ts' }).changed).toEqual({ files: [], workspaces: [], unbuilt: [] })
  })
})

describe('a rebuild that did not build', () => {
  it('names each target that failed with its output', () => {
    expect(
      DevServicesRunOutcomeSchema.parse({
        api: 1,
        ok: false,
        error: { code: 'build', message: 'Build failed' },
        failed: [{ target: '@sp/api', output: 'error TS2322' }, { target: '@sp/ui' }]
      }).failed
    ).toEqual([
      { target: '@sp/api', output: 'error TS2322' },
      { target: '@sp/ui', output: '' }
    ])
  })
})
