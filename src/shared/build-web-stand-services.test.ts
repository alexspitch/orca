import { describe, expect, it } from 'vitest'
import type { BuildWebImageBuild } from './build-web-image-types'
import type { BuildWebStandService } from './build-web-stand-types'
import { isFailingService, newerImageOf, standHealthOf } from './build-web-stand-services'

const service = (over: Partial<BuildWebStandService> = {}): BuildWebStandService => ({
  service: 'sa-backend',
  image: 'docker.spitch.ch/speechanalytics/sa-backend:3.1',
  runningImage: 'docker.spitch.ch/speechanalytics/sa-backend:3.1',
  state: 'running',
  health: '',
  status: 'Up 2 hours',
  container: 'sa31-sa-backend-1',
  build: '3.1b11830',
  imageCreatedAt: null,
  startedAt: null,
  ...over
})

const build = (tag: string, over: Partial<BuildWebImageBuild> = {}): BuildWebImageBuild => ({
  image: 'speechanalytics/sa-backend',
  dist: 'rhel',
  branch: 'release/3.1',
  number: Number(tag.split('b')[1]),
  status: 'success',
  raw_status: 'SUCCESS',
  ref: `docker.spitch.ch/speechanalytics/sa-backend:${tag}`,
  tag,
  version: '3.1',
  product: 'sa',
  product_version: '3.1',
  at: null,
  pushed_build_tag: true,
  pushed_main_tag: true,
  main_tag_on: null,
  run_id: 'run-1',
  url: null,
  ...over
})

describe('stand monitoring', () => {
  it('counts a service down or unhealthy as failing', () => {
    expect(isFailingService(service())).toBe(false)
    expect(isFailingService(service({ health: 'starting' }))).toBe(false)
    expect(isFailingService(service({ health: 'unhealthy' }))).toBe(true)
    expect(isFailingService(service({ state: 'exited' }))).toBe(true)
    expect(isFailingService(service({ state: 'absent' }))).toBe(false)
  })

  it('sees the newest build under the moving tag the compose names, in its own registry', () => {
    expect(newerImageOf(service(), [build('3.1b11900'), build('3.1b11950')])).toBe('3.1b11950')
    expect(newerImageOf(service(), [build('3.1b11830'), build('3.1b11700')])).toBeNull()
    // Not published under the moving tag: `up -d` would not pull it.
    expect(newerImageOf(service(), [build('3.1b11900', { pushed_main_tag: false })])).toBeNull()
    // Another line, another image.
    expect(newerImageOf(service(), [build('3.10b11900')])).toBeNull()
    expect(
      newerImageOf(service(), [
        build('3.1b11900', { ref: 'docker.spitch.ch/speechanalytics/sa-ui:3.1b11900' })
      ])
    ).toBeNull()
    // AP 1.16 on rhel: redos's registry holds the same path with interleaved build numbers.
    expect(
      newerImageOf(service(), [
        build('3.1b11831', {
          dist: 'redos',
          ref: 'docker.voice.bssys.com/speechanalytics/sa-backend:3.1b11831'
        })
      ])
    ).toBeNull()
    expect(newerImageOf(service({ build: null }), [build('3.1b11900')])).toBeNull()
  })

  it('judges only a running stand, and in it only the running services', () => {
    const stopped = { services: [service({ state: 'exited' })], detailsError: null }
    expect(standHealthOf('h:/d', stopped, [])).toEqual({
      instance: 'h:/d',
      running: false,
      failing: 0,
      outdated: 0,
      updates: [],
      error: null
    })
    const running = {
      services: [
        service(),
        service({ service: 'a', state: 'exited', runningImage: 'old:1', build: '3.1b100' }),
        service({ service: 'b', runningImage: 'sha256:abc', build: null }),
        service({ service: 'c', build: '3.1b100' })
      ],
      detailsError: null
    }
    const health = standHealthOf('h:/d', running, [build('3.1b11900')])
    expect(health.failing).toBe(1)
    expect(health.outdated).toBe(3)
    expect(health.updates?.map((u) => [u.service, u.running, u.newer])).toEqual([
      ['sa-backend', '3.1b11830', '3.1b11900'],
      ['b', null, null],
      ['c', '3.1b100', '3.1b11900']
    ])
  })
})
