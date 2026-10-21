// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AppState } from '../../store'
import type { UsageSource } from '@/store/slices/usage-hosts/usage-host-types'
import { UsageSourceSelect } from './UsageSourceSelect'

const state: { usageSource: UsageSource } = { usageSource: { kind: 'local' } }
const mockStoreState = {
  get usageSource() {
    return state.usageSource
  },
  setUsageSource: vi.fn()
} satisfies Partial<AppState>

vi.mock('../../store', () => ({
  useAppStore: (selector: (value: Partial<AppState>) => unknown) => selector(mockStoreState)
}))

afterEach(() => {
  cleanup()
  state.usageSource = { kind: 'local' }
})

describe('UsageSourceSelect', () => {
  it('stays out of the way until a server is paired', () => {
    render(<UsageSourceSelect servers={[]} />)
    expect(screen.queryByTestId('usage-source-select')).not.toBeInTheDocument()
  })

  it('names the chosen server, even after it dropped off the connected list', () => {
    state.usageSource = { kind: 'server', environmentId: 'env-dev', label: 'dev' }
    const { rerender } = render(<UsageSourceSelect servers={[{ id: 'env-dev', label: 'dev' }]} />)
    expect(screen.getByTestId('usage-source-select')).toHaveTextContent('dev')

    rerender(<UsageSourceSelect servers={[]} />)
    expect(screen.getByTestId('usage-source-select')).toHaveTextContent('dev')
  })

  it('reads all hosts as this computer and every server', () => {
    state.usageSource = { kind: 'all' }
    render(<UsageSourceSelect servers={[{ id: 'env-dev', label: 'dev' }]} />)
    expect(screen.getByTestId('usage-source-select')).toHaveTextContent(
      'This computer and all servers'
    )
  })
})
