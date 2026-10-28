import { describe, expect, it } from 'vitest'
import type { BuildWebImageBuild } from '../../../../../shared/build-web-image-types'
import { imageLinksByDist } from './image-links'

const refs = (builds: BuildWebImageBuild[], choice: 'rhel' | 'redos' | 'both' = 'both') =>
  imageLinksByDist(builds, choice).map((l) => l.ref)

const build = (over: Partial<BuildWebImageBuild>): BuildWebImageBuild => ({
  image: 'dc/dc-backend',
  dist: 'rhel',
  branch: 'master',
  number: 41,
  status: 'success',
  raw_status: 'SUCCESS',
  ref: 'registry.example/dc/dc-backend:3.6b41',
  tag: '3.6b41',
  version: '3.6',
  product: 'dc',
  product_version: '3.6',
  at: null,
  pushed_build_tag: true,
  pushed_main_tag: true,
  main_tag_on: null,
  run_id: 'run-1',
  url: null,
  ...over
})

describe('image links', () => {
  it('copies each build by its own tag, so the build number is in the link', () => {
    const links = refs([
      build({}),
      build({
        image: 'sa/sa-ui',
        ref: 'registry.example/sa/sa-ui:3.6b7',
        number: 7
      }),
      build({})
    ])
    expect(links).toEqual([
      'registry.example/dc/dc-backend:3.6b41',
      'registry.example/sa/sa-ui:3.6b7'
    ])
  })

  it('leaves out builds that made no image', () => {
    expect(refs([build({ status: 'failed' }), build({ status: 'running' })])).toEqual([])
    expect(refs([build({ ref: null })])).toEqual([])
  })

  it('counts the links the registry does not hold yet', () => {
    const builds = [
      build({}),
      build({ pushed_build_tag: false, number: 42, ref: 'registry.example/dc/dc-backend:3.6b42' }),
      build({ status: 'failed' })
    ]
    expect(imageLinksByDist(builds, 'both').filter((l) => !l.pushed)).toHaveLength(1)
  })

  it('gives a rhel build its redos twin, and only the distribution asked', () => {
    const twin = {
      dist: 'redos',
      number: 41,
      status: 'success' as const,
      ref: 'registry.example/dc/dc-backend:3.6b41-redos',
      pushed_build_tag: false,
      twin: 'derive' as const
    }
    const picked = [build({ pair: twin })]
    expect(refs(picked, 'both')).toEqual([
      'registry.example/dc/dc-backend:3.6b41',
      'registry.example/dc/dc-backend:3.6b41-redos'
    ])
    expect(refs(picked, 'redos')).toEqual(['registry.example/dc/dc-backend:3.6b41-redos'])
    expect(refs([build({ pair: { ...twin, status: 'running' } })], 'redos')).toEqual([])
  })
})
