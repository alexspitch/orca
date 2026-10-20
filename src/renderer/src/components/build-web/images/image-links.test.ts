import { describe, expect, it } from 'vitest'
import type { BuildWebImageBuild } from '../../../../../shared/build-web-image-types'
import { imageLinksOf, unpushedLinkCount } from './image-links'

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
    const links = imageLinksOf([
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
    expect(imageLinksOf([build({ status: 'failed' }), build({ status: 'running' })])).toEqual([])
    expect(imageLinksOf([build({ ref: null })])).toEqual([])
  })

  it('counts the links the registry does not hold yet', () => {
    const builds = [build({}), build({ pushed_build_tag: false }), build({ status: 'failed' })]
    expect(unpushedLinkCount(builds)).toBe(1)
  })
})
