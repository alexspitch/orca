// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, describe, expect, it } from 'vitest'
import type {
  BuildWebImageBuild,
  BuildWebPushProgress
} from '../../../../../shared/build-web-image-types'
import { RowRegistryCell } from './ImagePushProgress'
import { useImagePushes } from './image-push-runs'

const build: BuildWebImageBuild = {
  image: 'ap/ui',
  dist: 'rhel',
  branch: 'ap-release-1.16',
  number: 12,
  status: 'success',
  raw_status: 'SUCCESS',
  ref: null,
  tag: null,
  version: null,
  product: 'ap',
  product_version: '1.16',
  at: null,
  pushed_build_tag: false,
  pushed_main_tag: false,
  main_tag_on: null,
  run_id: 'r1',
  url: null
}

const progress = (over: Partial<BuildWebPushProgress>): BuildWebPushProgress => ({
  runId: 'p1',
  state: 'pushing',
  lines: [],
  ok: [],
  failed: [],
  error: null,
  ...over
})

// Why a DOM render: a server render reads the store's initial state, not the one set here.
Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
function cell(): string {
  const host = document.createElement('div')
  const root = createRoot(host)
  act(() => root.render(<RowRegistryCell rowKey="ap/ui|rhel" build={build} />))
  const html = host.innerHTML
  act(() => root.unmount())
  return html
}

beforeEach(() => useImagePushes.setState({ pushes: [], progress: {} }))

describe('a row’s registry during a push', () => {
  it('follows the push while it goes, image by image', () => {
    useImagePushes.setState({
      pushes: [{ runId: 'p1', keys: ['ap/ui|rhel', 'ap/api|rhel'], startedAt: 0 }],
      progress: { p1: progress({}) }
    })
    expect(cell()).toContain('pushing…')
    useImagePushes.setState({ progress: { p1: progress({ ok: ['ap/ui|rhel'] }) } })
    expect(cell()).toContain('pushed')
    useImagePushes.setState({ progress: { p1: progress({ failed: ['ap/ui|rhel'] }) } })
    expect(cell()).toContain('push failed')
  })

  it('shows the registry again once the push is over, and outside any push', () => {
    expect(cell()).not.toContain('pushing')
    useImagePushes.setState({
      pushes: [{ runId: 'p1', keys: ['ap/ui|rhel'], startedAt: 0 }],
      progress: { p1: progress({ state: 'done', ok: ['ap/ui|rhel'] }) }
    })
    expect(cell()).not.toContain('pushing…')
  })
})
