import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { DevServicesStatusSchema } from '../../../../shared/dev-services-contract'
import type { DevServicesActions } from './use-dev-services-actions'
import { DevServicesBody } from './DevServicesBody'
import { ConfirmationDialogContext } from '@/components/confirmation-dialog-context'

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>
}))

const actions: DevServicesActions = {
  pending: new Set(),
  run: vi.fn(),
  openConsole: vi.fn(),
  openUrl: vi.fn(),
  copyText: vi.fn()
}

const confirmAlways = async (): Promise<boolean> => true

function render(status: unknown, notice: Parameters<typeof DevServicesBody>[0]['notice'] = null) {
  return renderToStaticMarkup(
    <ConfirmationDialogContext.Provider value={confirmAlways}>
      <DevServicesBody
        status={DevServicesStatusSchema.parse(status)}
        notice={notice}
        refreshing={false}
        onRefresh={vi.fn()}
        actions={actions}
      />
    </ConfirmationDialogContext.Provider>
  )
}

describe('DevServicesBody', () => {
  it('lists running profiles with their ports, states and the repo’s own actions', () => {
    const html = render({
      api: 1,
      ok: true,
      worktree: { path: '/srv/wt', slot: 1, label: 'slot 1 · ports +10000' },
      profiles: [
        {
          id: 'dc',
          title: 'DC',
          services: ['dc-backend', 'dc-callflow-engine'],
          ready: 1,
          running: 2,
          total: 2
        }
      ],
      services: [
        {
          id: 'dc-backend',
          profile: 'dc',
          state: 'ready',
          ports: [{ port: 18077 }, { port: 18078 }]
        },
        {
          id: 'dc-callflow-engine',
          profile: 'dc',
          state: 'crashed',
          exit: 1,
          restarts: 4,
          ports: [{ port: 15000 }]
        }
      ],
      actions: [{ id: 'calls', label: 'Calls → main (slot 0)', verb: 'calls', args: [] }],
      problems: [{ message: 'dc-ui: node_modules missing' }]
    })

    expect(html).toContain('slot 1 · ports +10000')
    expect(html).toContain('DC')
    expect(html).toContain('1/2')
    expect(html).toContain(':18077')
    expect(html).toContain('+1')
    expect(html).toContain('exit 1')
    expect(html).toContain('restart #4')
    expect(html).toContain('Calls → main (slot 0)')
    expect(html).toContain('dc-ui: node_modules missing')
  })

  it('offers each profile when the worktree has never started a service', () => {
    const html = render({
      api: 1,
      ok: true,
      worktree: { path: '/srv/wt', slot: null, label: 'no slot' },
      profiles: [{ id: 'common' }, { id: 'dc' }],
      services: [{ id: 'dc-backend', profile: 'dc', state: 'stopped', ports: [] }]
    })

    expect(html).toContain('haven&#x27;t run in this worktree yet')
    expect(html).toContain('common')
    expect(html).not.toContain('dc-backend')
  })

  it('keeps the last known states visible when the host stops answering', () => {
    const html = render(
      {
        api: 1,
        ok: true,
        profiles: [{ id: 'dc', services: ['dc-backend'], running: 1, total: 1 }],
        services: [{ id: 'dc-backend', profile: 'dc', state: 'ready', ports: [] }]
      },
      { kind: 'unverifiable', message: 'timed out' }
    )

    expect(html).toContain('last known state')
    expect(html).toContain('dc-backend')
  })
})
