import { describe, expect, it } from 'vitest'
import type { BuildWebStandCard } from '../../shared/build-web-stand-types'
import { standAccountOf, standCardOf, standGroupsOf, standStatusOf } from './build-web-stand-model'

const card = (over: Partial<BuildWebStandCard> = {}): BuildWebStandCard => ({
  id: 'c1',
  name: 'dc 3.1',
  sshHost: '172.30.31.221',
  dir: '/opt/dc/3.1',
  branch: 'release/3.1',
  product: 'dc',
  products: ['dc'],
  uiUrl: 'https://dc.invalid',
  enabled: true,
  lock: null,
  ...over
})

describe('stands as people mean them', () => {
  it('folds the cards of one host, directory and branch into one stand', () => {
    const groups = standGroupsOf([
      card({ id: 'c1', name: '3.1 box SA' }),
      card({ id: 'c2', name: '3.1 box AP', product: 'ap' }),
      card({ id: 'c3', name: 'other', dir: '/opt/dc/3.2' })
    ])
    expect(groups.map((g) => [g.name, g.cards.map((c) => c.id)])).toEqual([
      ['3.1 box', ['c1', 'c2']],
      ['other', ['c3']]
    ])
  })

  it('shows only the AP, DC, SA and CP stands, and only those cards of a machine', () => {
    const groups = standGroupsOf([
      card({ id: 'dc', name: 'box dc' }),
      card({ id: 'st', name: 'box storage', product: 'storage' }),
      card({ id: 'tools', name: 'tools', dir: '/opt/tools', product: 'tools' }),
      card({ id: 'none', name: 'unset', dir: '/opt/none', product: null }),
      card({ id: 'ap', name: 'ap', dir: '/opt/ap', product: 'ap' }),
      card({ id: 'sa', name: 'sa', dir: '/opt/sa', product: 'sa' }),
      card({ id: 'cp', name: 'cp', dir: '/opt/chat-platform/2.7', product: 'cp' })
    ])
    expect(groups.map((g) => g.cards.map((c) => c.id))).toEqual([['ap'], ['dc'], ['cp'], ['sa']])
  })

  it('keeps a stand apart by branch even over one directory', () => {
    expect(standGroupsOf([card({ id: 'a' }), card({ id: 'b', branch: 'master' })])).toHaveLength(2)
  })

  it('names a stand by its cards when they share no name', () => {
    const [group] = standGroupsOf([card({ id: 'a', name: 'dc' }), card({ id: 'b', name: 'ap' })])
    expect(group.name).toBe('dc · ap')
  })

  it('operates through an enabled card and lists disabled stands last', () => {
    const groups = standGroupsOf([
      card({ id: 'off', name: 'a off', dir: '/x', enabled: false }),
      card({ id: 'd1', name: 'b', enabled: false }),
      card({ id: 'd2', name: 'b', enabled: true, lock: { heldBy: 'deploy:1', since: null } })
    ])
    expect(groups.map((g) => [g.opsCardId, g.statusCardId, g.enabled])).toEqual([
      ['d2', 'd2', true],
      [null, 'off', false]
    ])
    expect(groups[0].lock?.heldBy).toBe('deploy:1')
  })

  it('reads a card as build-web sends it', () => {
    expect(
      standCardOf({
        id: 'c1',
        name: 'dc',
        ssh_host: 'h',
        dir: '/opt',
        branch: '',
        product: 'dc',
        products: ['dc', 7],
        ui_url: 'https://u',
        enabled: false,
        lock: { held_by: 'test:9', since: '2026-10-19T08:00:00Z' }
      })
    ).toEqual({
      id: 'c1',
      name: 'dc',
      sshHost: 'h',
      dir: '/opt',
      branch: null,
      product: 'dc',
      products: ['dc'],
      uiUrl: 'https://u',
      enabled: false,
      lock: { heldBy: 'test:9', since: '2026-10-19T08:00:00Z' }
    })
    expect(standCardOf({ name: 'no id' })).toBeNull()
  })
})

describe('what a stand runs', () => {
  it('reads the build and the start, and leaves them empty from an older build-web', () => {
    const status = standStatusOf({
      services: [
        {
          service: 'sa-backend',
          image: 'x:3.1',
          state: 'running',
          health: 'healthy',
          status: 'Up 2 hours',
          container: 'c',
          running_image: 'x:3.1',
          build: '3.1b11830',
          image_created: '2026-10-18T21:05:11Z',
          started_at: '2026-10-19T08:00:00Z'
        },
        { service: 'old', image: 'y:1', state: 'absent', container: null, running_image: null },
        { image: 'no name' }
      ],
      details_error: null
    })
    expect(status.services).toHaveLength(2)
    expect(status.services[0]).toMatchObject({
      build: '3.1b11830',
      imageCreatedAt: '2026-10-18T21:05:11Z'
    })
    expect(status.services[1]).toMatchObject({
      build: null,
      imageCreatedAt: null,
      startedAt: null,
      status: ''
    })
  })

  it('reads a login without ever expecting its password', () => {
    expect(
      standAccountOf({
        id: 'a1',
        description: 'admin',
        email: 'a@b.c',
        stand_id: 'c1',
        role_key: 'admin',
        project_name: 'P',
        password: 'set'
      })
    ).toEqual({
      id: 'a1',
      description: 'admin',
      email: 'a@b.c',
      standId: 'c1',
      role: 'admin',
      projectName: 'P',
      password: 'set'
    })
    expect(standAccountOf({ id: 'loose', stand_id: null })).toBeNull()
  })
})
