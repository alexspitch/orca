import { describe, expect, it } from 'vitest'
import type { BuildWebImageBuild } from '../../shared/build-web-image-types'
import { offersBuildTagOnly, offersMainTag, pushRequests } from '../../shared/build-web-image-push'
import {
  imageHistory,
  imagePage,
  runningImageCount,
  type ImageCatalog
} from './build-web-image-model'
import { imageCatalogOf } from './build-web-images'

const build = (over: Partial<BuildWebImageBuild>): BuildWebImageBuild => ({
  image: 'sa/api',
  dist: 'rhel',
  branch: 'master',
  number: 1,
  status: 'success',
  raw_status: 'SUCCESS',
  ref: 'reg/sa/api:3.1b1',
  tag: '3.1b1',
  version: '3.1',
  product: 'sa',
  product_version: '3.1',
  at: '2026-10-17T09:00:00Z',
  pushed_build_tag: false,
  pushed_main_tag: false,
  main_tag_on: null,
  run_id: 'run-1',
  url: null,
  ...over
})

const catalog: ImageCatalog = {
  images: [
    { image: 'sa/api', product: 'sa' },
    { image: 'sa/ui', product: 'sa' },
    { image: 'dc/asr', product: 'dc' }
  ],
  builds: [
    // The console's order: newest first.
    build({ number: 2, at: '2026-10-17T09:00:00Z', tag: '3.1b2' }),
    build({ number: 1, at: '2026-10-16T09:00:00Z' }),
    build({ image: 'sa/ui', dist: 'redos', status: 'running', ref: null }),
    build({ image: 'sa/ui', dist: 'redos', status: 'running', ref: null, run_id: 'run-2' }),
    build({
      image: 'dc/asr',
      product: 'dc',
      status: 'running',
      ref: null,
      version: '2.16',
      product_version: '2.16'
    })
  ],
  versions: { sa: ['3.1'], dc: ['2.16'] }
}

describe('image model', () => {
  it('counts images building now once per image and distribution', () => {
    expect(runningImageCount(catalog)).toBe(2)
  })

  it('shows the newest build of each image and counts the chips', () => {
    const page = imagePage(catalog, { page: 0, pageSize: 50 })
    expect(page.rows.find((r) => r.image === 'sa/api')?.last?.tag).toBe('3.1b2')
    expect(page.counts.products).toEqual({ sa: 2, dc: 1 })
    expect(page.total).toBe(3)
    expect(page.versions.sort()).toEqual(['2.16', '3.1'])
  })

  it('filters by product, distribution, version and text', () => {
    expect(
      imagePage(catalog, { page: 0, pageSize: 50, products: ['dc'] }).rows.map((r) => r.image)
    ).toEqual(['dc/asr'])
    expect(
      imagePage(catalog, { page: 0, pageSize: 50, dists: ['redos'] }).rows.map((r) => r.image)
    ).toEqual(['sa/ui'])
    expect(imagePage(catalog, { page: 0, pageSize: 50, version: '2.16' }).total).toBe(1)
    expect(
      imagePage(catalog, { page: 0, pageSize: 50, q: '3.1b2' }).rows.map((r) => r.image)
    ).toEqual(['sa/api'])
  })

  it('filters builds before picking the newest, as build-web does', () => {
    const older: ImageCatalog = {
      ...catalog,
      builds: [
        build({ at: '2026-10-17T09:00:00Z', product_version: '3.2' }),
        build({ at: '2026-10-10T09:00:00Z', dist: 'redos', tag: '3.1old' })
      ]
    }
    const redos = imagePage(older, { page: 0, pageSize: 50, dists: ['redos'] })
    expect(redos.rows.map((r) => r.last?.tag)).toEqual(['3.1old'])
    expect(redos.counts.dists).toEqual({ rhel: 1, redos: 1 })
    expect(imagePage(older, { page: 0, pageSize: 50, version: '3.1' }).total).toBe(1)
    expect(imagePage(older, { page: 0, pageSize: 50, q: '3.1old' }).total).toBe(1)
  })

  it('keeps the console’s order for a build with no start time', () => {
    const adopted: ImageCatalog = {
      ...catalog,
      builds: [build({ number: 12, at: null, tag: '3.1b12' }), build({ number: 11, tag: '3.1b11' })]
    }
    const page = imagePage(adopted, { page: 0, pageSize: 50 })
    expect(page.rows.find((r) => r.image === 'sa/api')?.last?.number).toBe(12)
  })

  it('sorts the whole list before it cuts a page, empty cells last', () => {
    const byStatus = imagePage(catalog, { page: 0, pageSize: 50, sort: 'status', dir: 'asc' })
    expect(byStatus.rows.map((r) => r.last?.status)).toEqual(['running', 'running', 'success'])
    const byName = imagePage(catalog, { page: 0, pageSize: 50, sort: 'image', dir: 'desc' })
    expect(byName.rows.map((r) => r.image)).toEqual(['sa/ui', 'sa/api', 'dc/asr'])
    const history = imageHistory(catalog, {
      image: 'sa/api',
      page: 0,
      pageSize: 50,
      sort: 'tag',
      dir: 'asc'
    })
    expect(history.builds.map((b) => b.tag)).toEqual(['3.1b1', '3.1b2'])
  })

  it('narrows to the rows whose last build is running or failed, and counts them', () => {
    const running = imagePage(catalog, { page: 0, pageSize: 50, statuses: ['running'] })
    expect(running.rows.map((r) => r.image).sort()).toEqual(['dc/asr', 'sa/ui'])
    expect(running.counts.statuses).toEqual({ success: 1, running: 2 })
  })

  it('pages, and an unknown page size falls back to 50', () => {
    const many: ImageCatalog = {
      ...catalog,
      images: Array.from({ length: 120 }, (_, i) => ({ image: `img-${i}`, product: 'sa' })),
      builds: []
    }
    expect(imagePage(many, { page: 2, pageSize: 50 }).rows).toHaveLength(20)
    expect(imagePage(many, { page: 99, pageSize: 50 }).rows).toHaveLength(20)
    expect(imagePage(many, { page: 0, pageSize: 7 }).rows).toHaveLength(50)
  })

  it('lists one image’s builds newest first, with their own chips', () => {
    const history = imageHistory(catalog, { image: 'sa/api', page: 0, pageSize: 50 })
    expect(history.builds.map((b) => b.number)).toEqual([2, 1])
    expect(history.counts.pushed).toEqual({ no: 2 })
    expect(
      imageHistory(catalog, { image: 'sa/api', page: 0, pageSize: 50, statuses: ['failed'] }).total
    ).toBe(0)
  })

  it('reads the console’s answer, dropping records that are not builds', () => {
    const parsed = imageCatalogOf(
      {
        images: [{ image: 'a', product: 'sa' }, { nope: 1 }],
        builds: [
          build({ url: '/logs/run-1/api.log' }),
          { image: 'x', status: 'weird', run_id: 'r' },
          build({ url: 'javascript:alert(1)' })
        ],
        versions: { sa: ['3.1', 7] }
      },
      'https://bw.test'
    )
    expect(parsed.images).toHaveLength(1)
    expect(parsed.builds.map((b) => b.url)).toEqual(['https://bw.test/logs/run-1/api.log', null])
    expect(parsed.versions).toEqual({ sa: ['3.1'] })
  })
})

describe('pushing to the registry', () => {
  it('groups pushable builds by run and offers only the tags that can still move', () => {
    const fresh = build({ run_id: 'r1' })
    const tagged = build({ run_id: 'r2', image: 'sa/ui', pushed_build_tag: true })
    const running = build({ status: 'running', ref: null })
    expect(offersBuildTagOnly([fresh, tagged])).toBe(true)
    expect(offersMainTag([tagged])).toBe(true)
    expect(offersMainTag([build({ pushed_build_tag: true, main_tag_on: '3.1b9' })])).toBe(false)
    expect(pushRequests([fresh, tagged, running], false)).toEqual([
      {
        runId: 'r1',
        combos: [{ image: 'sa/api', dist: 'rhel', branch: 'master' }],
        moveMainTag: false
      }
    ])
    expect(pushRequests([fresh, tagged], true).map((r) => r.runId)).toEqual(['r1', 'r2'])
  })
})
