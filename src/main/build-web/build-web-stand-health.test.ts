import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BuildWebStandGroup } from '../../shared/build-web-stand-types'

const fetchStatus = vi.fn()
const group = (key: string, enabled = true, dir = `/opt/${key}`): BuildWebStandGroup => ({
  key,
  name: key,
  sshHost: 'h',
  dir,
  branch: null,
  cards: [],
  enabled,
  lock: null,
  statusCardId: `card-${key}`,
  opsCardId: enabled ? `card-${key}` : null
})

vi.mock('./build-web-connection', () => ({
  requireBuildWebCredential: () => ({ baseUrl: 'https://bw', token: 't', generation: 1 })
}))
vi.mock('./build-web-images', () => ({ recentBuildWebImageBuilds: async () => [] }))
vi.mock('./build-web-stands', () => ({
  fetchBuildWebStandGroups: async () => [
    group('a'),
    group('b'),
    group('off', false),
    // SA over AP's directory, another branch: one compose project.
    group('a-sa', true, '/opt/a')
  ],
  fetchBuildWebStandStatus: (_credential: unknown, id: string) => fetchStatus(id)
}))

const { readBuildWebStandHealth, _resetBuildWebStandHealthCache } =
  await import('./build-web-stand-health')

describe('stand monitoring on the host', () => {
  beforeEach(() => {
    _resetBuildWebStandHealthCache()
    fetchStatus.mockReset()
    fetchStatus.mockResolvedValue({
      services: [
        { service: 's', image: 'x:1', runningImage: 'x:1', state: 'exited', health: '' },
        { service: 'r', image: 'x:1', runningImage: 'x:1', state: 'running', health: '' }
      ],
      detailsError: null
    })
  })

  it('reads neither a hidden nor a disabled stand', async () => {
    const result = await readBuildWebStandHealth({ hidden: ['b', 'a-sa'] })
    expect(fetchStatus.mock.calls).toEqual([['card-a']])
    expect(result.ok && Object.keys(result.value)).toEqual(['a'])
    expect(result.ok && result.value.a.failing).toBe(1)
  })

  it('reads the stands over one directory once and gives each the same answer', async () => {
    const result = await readBuildWebStandHealth({ hidden: ['b'] })
    expect(fetchStatus.mock.calls).toEqual([['card-a']])
    expect(result.ok && result.value['a-sa']).toMatchObject({ instance: 'h:/opt/a', failing: 1 })
    expect(result.ok && result.value['a-sa'].name).toBe('a-sa')
  })

  it('reads only the stand shown again, the others come from the cache', async () => {
    await readBuildWebStandHealth({ hidden: ['b'] })
    const result = await readBuildWebStandHealth({})
    expect(fetchStatus.mock.calls).toEqual([['card-a'], ['card-b']])
    expect(result.ok && Object.keys(result.value).sort()).toEqual(['a', 'a-sa', 'b'])
  })

  it('reads every shown stand again on refresh', async () => {
    await readBuildWebStandHealth({})
    await readBuildWebStandHealth({ refresh: true })
    expect(fetchStatus).toHaveBeenCalledTimes(4)
  })
})
