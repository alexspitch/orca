import { describe, expect, it } from 'vitest'
import { recordedSessionHostId, recordedSessionServer } from './build-web-session-host'

describe('task session host', () => {
  it('records the build-web host as `local` from any client', () => {
    // A desktop reading build-web through server E, a phone connected to E, and E's own desktop.
    expect(recordedSessionHostId('runtime:env-mac', true)).toBe('local')
    expect(recordedSessionHostId(undefined, true)).toBe('local')
    expect(recordedSessionHostId('local', true)).toBe('local')
    expect(recordedSessionHostId('ssh:box', true)).toBe('ssh:box')
  })

  it('records another server by the id this client gave it', () => {
    expect(recordedSessionHostId('runtime:env-2', false)).toBe('runtime:env-2')
  })

  it('reads a server only this client knows; the rest is the build-web host', () => {
    const knows = (host: { environmentId: string }) => host.environmentId === 'env-mine'
    expect(recordedSessionServer('runtime:env-mine', knows)?.environmentId).toBe('env-mine')
    expect(recordedSessionServer('runtime:env-other-desktop', knows)).toBeNull()
    expect(recordedSessionServer('local', knows)).toBeNull()
    expect(recordedSessionServer('', knows)).toBeNull()
  })
})
