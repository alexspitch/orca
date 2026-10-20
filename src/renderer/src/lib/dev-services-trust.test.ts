import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppState } from '@/store/types'
import { __resetTrustPromptChainForTests, ensureHooksConfirmed } from './ensure-hooks-confirmed'
import { readDevServicesTrust } from './dev-services-trust'
import { hashOrcaHookScript } from './orca-hook-trust'

const hooksCheckMock = vi.fn()
const COMMAND = 'node "$ORCA_ROOT_PATH/utils/orca-run.mjs" orca'

type PendingPrompt = { data: Record<string, unknown>; resolve: (d: 'run' | 'skip') => void }

function createState(commandSourcePolicy?: 'local-only' | 'shared-only'): {
  state: AppState
  pending: PendingPrompt[]
} {
  const pending: PendingPrompt[] = []
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the trust helpers read only repos, trustedOrcaHooks and openModal.
  const state = {
    trustedOrcaHooks: {},
    repos: [
      {
        id: 'repo-1',
        displayName: 'Repo One',
        ...(commandSourcePolicy
          ? {
              hookSettings: {
                mode: 'auto',
                commandSourcePolicy,
                scripts: { setup: 'echo local', archive: '' }
              }
            }
          : {})
      }
    ],
    openModal: (_modal: string, data: Record<string, unknown>) => {
      const onResolve = data.onResolve
      if (typeof onResolve === 'function') {
        pending.push({ data, resolve: (decision) => onResolve(decision) })
      }
    }
  } as unknown as AppState
  return { state, pending }
}

describe('services command trust', () => {
  beforeEach(() => {
    hooksCheckMock.mockReset()
    vi.stubGlobal('window', { api: { hooks: { check: hooksCheckMock } } })
    __resetTrustPromptChainForTests()
  })

  it('prompts with the command from orca.yaml', async () => {
    const { state, pending } = createState()
    hooksCheckMock.mockResolvedValue({
      hasHooks: true,
      hooks: { scripts: {}, services: { command: COMMAND } },
      mayNeedUpdate: false
    })

    const decision = ensureHooksConfirmed(state, 'repo-1', 'services', 'local')

    await vi.waitFor(() => expect(pending).toHaveLength(1))
    expect(pending[0].data).toMatchObject({ scriptKind: 'services', scriptContent: COMMAND })
    pending[0].resolve('run')
    await expect(decision).resolves.toBe('run')
  })

  it('skips without prompting when the project runs local commands only', async () => {
    const { state, pending } = createState('local-only')

    await expect(ensureHooksConfirmed(state, 'repo-1', 'services', 'local')).resolves.toBe('skip')
    expect(hooksCheckMock).not.toHaveBeenCalled()
    expect(pending).toHaveLength(0)
  })

  it('skips when orca.yaml has no services command', async () => {
    const { state, pending } = createState()
    hooksCheckMock.mockResolvedValue({
      hasHooks: true,
      hooks: { scripts: {} },
      mayNeedUpdate: false
    })

    await expect(ensureHooksConfirmed(state, 'repo-1', 'services', 'local')).resolves.toBe('skip')
    expect(pending).toHaveLength(0)
  })

  it('reads trust for polling without ever prompting', async () => {
    const { state, pending } = createState()
    const hash = await hashOrcaHookScript(COMMAND)

    await expect(readDevServicesTrust(state, 'repo-1', COMMAND)).resolves.toEqual({
      state: 'untrusted',
      commandHash: hash
    })
    state.trustedOrcaHooks['repo-1'] = { services: { contentHash: hash, approvedAt: 1 } }
    await expect(readDevServicesTrust(state, 'repo-1', COMMAND)).resolves.toEqual({
      state: 'trusted',
      commandHash: hash
    })
    await expect(
      readDevServicesTrust(state, 'repo-1', `${COMMAND} --changed`)
    ).resolves.toMatchObject({ state: 'untrusted' })
    expect(pending).toHaveLength(0)
  })

  it('reports a local-only project as disabled', async () => {
    const { state } = createState('local-only')

    await expect(readDevServicesTrust(state, 'repo-1', COMMAND)).resolves.toMatchObject({
      state: 'disabled'
    })
  })
})
