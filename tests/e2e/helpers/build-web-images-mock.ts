import type http from 'node:http'

// build-web's /api/image-builds for the Images page: an image in the registry with an older
// build, one built and never pushed, and one whose build failed (no image to link).

const REGISTRY = 'registry.box.test'

const build = (over: Record<string, unknown>) => ({
  dist: 'rhel',
  branch: 'master',
  status: 'success',
  raw_status: 'SUCCESS',
  version: '3.6',
  product_version: '3.6',
  at: '2026-10-19T08:00:00Z',
  pushed_build_tag: true,
  pushed_main_tag: true,
  main_tag_on: null,
  run_id: 'run-1',
  url: null,
  ...over
})

export const IMAGE_REFS = {
  backend: `${REGISTRY}/dc/dc-backend:3.6b412`,
  backendOlder: `${REGISTRY}/dc/dc-backend:3.6b411`,
  ui: `${REGISTRY}/dc/dc-ui:3.6b87`
}

const IMAGE_BUILDS = {
  images: [
    { image: 'dc/dc-backend', product: 'dc' },
    { image: 'dc/dc-ui', product: 'dc' },
    { image: 'sa/sa-backend', product: 'sa' }
  ],
  builds: [
    build({
      image: 'dc/dc-backend',
      product: 'dc',
      number: 412,
      ref: IMAGE_REFS.backend,
      tag: '3.6b412'
    }),
    build({
      image: 'dc/dc-ui',
      product: 'dc',
      number: 87,
      ref: IMAGE_REFS.ui,
      tag: '3.6b87',
      pushed_build_tag: false,
      pushed_main_tag: false,
      run_id: 'run-2'
    }),
    build({
      image: 'sa/sa-backend',
      product: 'sa',
      number: 55,
      status: 'failed',
      raw_status: 'FAILURE',
      ref: null,
      tag: null,
      run_id: 'run-3'
    }),
    build({
      image: 'dc/dc-backend',
      product: 'dc',
      number: 411,
      ref: IMAGE_REFS.backendOlder,
      tag: '3.6b411',
      at: '2026-10-18T08:00:00Z',
      pushed_main_tag: false,
      main_tag_on: '3.6b412',
      run_id: 'run-0'
    })
  ],
  versions: { dc: ['3.6'], sa: ['3.6'] }
}

export function serveImageBuilds(
  res: http.ServerResponse,
  path: string,
  json: (res: http.ServerResponse, status: number, body: unknown) => void
): boolean {
  if (path !== '/api/image-builds') {
    return false
  }
  json(res, 200, IMAGE_BUILDS)
  return true
}
