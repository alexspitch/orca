import { describe, expect, it } from 'vitest'
import { DevServicesStatusSchema } from '../../../../shared/dev-services-contract'
import {
  formatDevServiceElapsed,
  groupDevServices,
  runningDevServiceIds
} from './dev-services-sections'

const status = DevServicesStatusSchema.parse({
  api: 1,
  ok: true,
  profiles: [
    { id: 'common', services: ['ap-backend', 'ap-ui'] },
    { id: 'dc', includes: ['common'], services: ['dc-backend', 'dc-ui'] }
  ],
  services: [
    { id: 'dc-ui', profile: 'dc', state: 'starting', ports: [] },
    { id: 'ap-ui', profile: 'common', state: 'ready', ports: [] },
    { id: 'dc-indexer', profile: null, state: 'stopped', ports: [] },
    { id: 'ap-backend', profile: 'common', state: 'crashed', ports: [] },
    { id: 'dc-backend', profile: 'dc', state: 'stopped', ports: [] },
    { id: 'dc-code', profile: 'dc', state: 'ready', ports: [] }
  ]
})

describe('groupDevServices', () => {
  it('puts each profile’s own services in its listed order and keeps includes out', () => {
    const groups = groupDevServices(status)

    expect(groups.profiles.map((group) => group.services.map((service) => service.id))).toEqual([
      ['ap-backend', 'ap-ui'],
      ['dc-backend', 'dc-ui', 'dc-code']
    ])
    expect(groups.other.map((service) => service.id)).toEqual(['dc-indexer'])
  })
})

describe('runningDevServiceIds', () => {
  it('counts crashed and starting services as running: their wrappers are alive', () => {
    expect(runningDevServiceIds(status)).toEqual(['dc-ui', 'ap-ui', 'ap-backend', 'dc-code'])
  })
})

describe('formatDevServiceElapsed', () => {
  it('reads seconds, then minutes, then hours', () => {
    const now = 1_000_000 * 1000
    expect(formatDevServiceElapsed(1_000_000 - 12, now)).toBe('12 s')
    expect(formatDevServiceElapsed(1_000_000 - 180, now)).toBe('3 min')
    expect(formatDevServiceElapsed(1_000_000 - 7200, now)).toBe('2 h')
    expect(formatDevServiceElapsed(1_000_000 + 5, now)).toBe('0 s')
  })
})
