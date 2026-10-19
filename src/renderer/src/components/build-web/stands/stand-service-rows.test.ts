import { describe, expect, it } from 'vitest'
import type { BuildWebStandService } from '../../../../../shared/build-web-stand-types'
import {
  buildNumberOf,
  imagePartsOf,
  isNotApplied,
  serviceStateLabel,
  serviceStateTone
} from './stand-service-rows'

const service = (over: Partial<BuildWebStandService> = {}): BuildWebStandService => ({
  service: 'sa-backend',
  image: 'docker.spitch.ch/speechanalytics/sa-backend:3.1',
  runningImage: 'docker.spitch.ch/speechanalytics/sa-backend:3.1',
  state: 'running',
  health: '',
  status: 'Up 2 hours',
  container: 'sa31-sa-backend-1',
  build: '3.1b11830',
  imageCreatedAt: '2026-10-18T21:05:11Z',
  startedAt: '2026-10-19T08:00:00Z',
  ...over
})

describe('a stand service row', () => {
  it('colours the state by what it means for the stand', () => {
    expect(serviceStateTone(service())).toBe('green')
    expect(serviceStateTone(service({ health: 'unhealthy' }))).toBe('red')
    expect(serviceStateTone(service({ health: 'starting' }))).toBe('amber')
    expect(serviceStateTone(service({ state: 'exited' }))).toBe('red')
    expect(serviceStateTone(service({ state: 'absent' }))).toBe('faint')
  })

  it('names the health beside a running state only', () => {
    expect(serviceStateLabel(service({ health: 'healthy' }))).toBe('running · healthy')
    expect(serviceStateLabel(service({ state: 'exited', health: 'unhealthy' }))).toBe('exited')
  })

  it('splits an image reference by Docker’s rule for the registry host', () => {
    expect(imagePartsOf('docker.spitch.ch/dc/ib-script-engine:3.1')).toEqual({
      host: 'docker.spitch.ch',
      path: 'dc/ib-script-engine',
      tag: '3.1'
    })
    expect(imagePartsOf('python3-pika:latest')).toEqual({
      host: null,
      path: 'python3-pika',
      tag: 'latest'
    })
    expect(imagePartsOf('localhost:5000/x').tag).toBe('latest')
  })

  it('reads the build number off the immutable tag', () => {
    expect(buildNumberOf('3.1b11830')).toBe('11830')
    expect(buildNumberOf('3.1')).toBeNull()
    expect(buildNumberOf(null)).toBeNull()
  })

  it('tells a container that runs an image the compose no longer names', () => {
    expect(isNotApplied(service())).toBe(false)
    expect(isNotApplied(service({ runningImage: 'x:1' }))).toBe(true)
    expect(isNotApplied(service({ runningImage: null }))).toBe(false)
  })
})
