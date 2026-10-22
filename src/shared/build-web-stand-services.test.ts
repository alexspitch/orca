import { describe, expect, it } from 'vitest'
import type { BuildWebImageBuild } from './build-web-image-types'
import type { BuildWebStandService } from './build-web-stand-types'
import { hasNewerImage, isFailingService, standHealthOf } from './build-web-stand-services'

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

  it('sees a newer build under the moving tag the compose names', () => {
    expect(hasNewerImage(service(), [build('3.1b11900')])).toBe(true)
    expect(hasNewerImage(service(), [build('3.1b11830'), build('3.1b11700')])).toBe(false)
    // Not published under the moving tag: `up -d` would not pull it.
    expect(hasNewerImage(service(), [build('3.1b11900', { pushed_main_tag: false })])).toBe(false)
    // Another line, another image.
    expect(hasNewerImage(service(), [build('3.10b11900')])).toBe(false)
    expect(
      hasNewerImage(service(), [
        build('3.1b11900', { ref: 'docker.spitch.ch/speechanalytics/sa-ui:3.1b11900' })
      ])
    ).toBe(false)
    expect(hasNewerImage(service({ build: null }), [build('3.1b11900')])).toBe(false)
  })

  it('judges only a running stand', () => {
    const stopped = { services: [service({ state: 'exited' })], detailsError: null }
    expect(standHealthOf(stopped, [])).toEqual({
      running: false,
      failing: 0,
      outdated: 0,
      error: null
    })
    const running = {
      services: [
        service(),
        service({ service: 'a', state: 'exited' }),
        service({ service: 'b', runningImage: 'old:1' }),
        service({ service: 'c', build: '3.1b100' })
      ],
      detailsError: null
    }
    expect(standHealthOf(running, [build('3.1b11900')])).toEqual({
      running: true,
      failing: 1,
      outdated: 4,
      error: null
    })
  })
})
