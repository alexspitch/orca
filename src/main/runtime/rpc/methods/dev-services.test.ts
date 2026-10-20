import '../unused-default-rpc-methods.test-fixture'
import { describe, expect, it, vi } from 'vitest'
import { RpcDispatcher } from '../dispatcher'
import type { RpcRequest } from '../core'
import type { OrcaRuntimeService } from '../../orca-runtime'
import { DEV_SERVICES_METHODS } from './dev-services'
import { getHostOperationOwnership } from '../../../../shared/host-operation-ownership'

function devServicesRuntime(
  methods: Partial<Pick<OrcaRuntimeService, 'devServicesStatus' | 'devServicesRun'>>
): OrcaRuntimeService {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: dispatch reaches only the runtime id and the one dev-services method each test stubs.
  return { getRuntimeId: () => 'test-runtime', ...methods } as unknown as OrcaRuntimeService
}

function makeRequest(method: string, params?: unknown): RpcRequest {
  return { id: 'req-1', authToken: 'tok', method, params }
}

describe('dev services RPC methods', () => {
  it('asks the runtime for the status of the named worktree with the trusted hash', async () => {
    const status = { kind: 'status', status: { api: 1, ok: true } }
    const runtime = devServicesRuntime({ devServicesStatus: vi.fn().mockResolvedValue(status) })
    const dispatcher = new RpcDispatcher({ runtime, methods: DEV_SERVICES_METHODS })

    const response = await dispatcher.dispatch(
      makeRequest('devServices.status', { worktree: 'id:wt-1', commandHash: 'abc' })
    )

    expect(runtime.devServicesStatus).toHaveBeenCalledWith(
      { worktree: 'id:wt-1', commandHash: 'abc' },
      undefined
    )
    expect(response).toMatchObject({ ok: true, result: status })
  })

  it('runs a verb with its arguments', async () => {
    const outcome = { kind: 'done', outcome: { api: 1, ok: true } }
    const runtime = devServicesRuntime({ devServicesRun: vi.fn().mockResolvedValue(outcome) })
    const dispatcher = new RpcDispatcher({ runtime, methods: DEV_SERVICES_METHODS })

    const response = await dispatcher.dispatch(
      makeRequest('devServices.run', {
        worktree: 'id:wt-1',
        commandHash: 'abc',
        verb: 'start',
        args: ['dc']
      })
    )

    expect(runtime.devServicesRun).toHaveBeenCalledWith({
      worktree: 'id:wt-1',
      commandHash: 'abc',
      verb: 'start',
      args: ['dc']
    })
    expect(response).toMatchObject({ ok: true, result: outcome })
  })

  it.each([
    ['a verb that is not a plain word', { verb: 'start; rm -rf /', args: [] }],
    ['too many arguments', { verb: 'start', args: Array.from({ length: 17 }, () => 'x') }],
    ['an over-long argument', { verb: 'start', args: ['x'.repeat(257)] }],
    ['no command hash', { verb: 'start', args: [], commandHash: '' }]
  ])('refuses %s before the runtime sees it', async (_name, overrides) => {
    const runtime = devServicesRuntime({ devServicesRun: vi.fn() })
    const dispatcher = new RpcDispatcher({ runtime, methods: DEV_SERVICES_METHODS })

    const response = await dispatcher.dispatch(
      makeRequest('devServices.run', { worktree: 'id:wt-1', commandHash: 'abc', ...overrides })
    )

    expect(response).toMatchObject({ ok: false })
    expect(runtime.devServicesRun).not.toHaveBeenCalled()
  })

  it('is owned by the workspace host', () => {
    expect(getHostOperationOwnership('devServices.status')).toBe('host')
    expect(getHostOperationOwnership('devServices.run')).toBe('host')
  })
})
