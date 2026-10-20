import React, { useCallback, useEffect, useState } from 'react'
import { Layers, ShieldQuestion } from 'lucide-react'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { Button } from '@/components/ui/button'
import { ensureHooksConfirmed } from '@/lib/ensure-hooks-confirmed'
import { readDevServicesTrust, type DevServicesTrust } from '@/lib/dev-services-trust'
import { useDevServicesAvailability } from './use-dev-services-availability'
import { useDevServicesStatus } from './use-dev-services-status'
import { useDevServicesActions } from './use-dev-services-actions'
import { DevServicesBody } from './DevServicesBody'

function Placeholder({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center text-xs text-muted-foreground">
      {children}
    </div>
  )
}

/** Services of one worktree: trust gate, polling, and the list. */
export function DevServicesView({
  worktreeId,
  isVisible
}: {
  worktreeId: string | null
  isVisible: boolean
}): React.JSX.Element {
  const availability = useDevServicesAvailability(worktreeId, isVisible)
  const trustedOrcaHooks = useAppStore((state) => state.trustedOrcaHooks)
  const [trust, setTrust] = useState<(DevServicesTrust & { command: string }) | null>(null)

  useEffect(() => {
    if (!availability) {
      return
    }
    let cancelled = false
    void readDevServicesTrust(
      useAppStore.getState(),
      availability.repoId,
      availability.command
    ).then((next) => {
      if (!cancelled) {
        setTrust({ ...next, command: availability.command })
      }
    })
    return () => {
      cancelled = true
    }
  }, [availability, trustedOrcaHooks])

  // Why compare the command: a trust verdict read for an older orca.yaml must not unlock the new one.
  const currentTrust =
    trust && availability && trust.command === availability.command ? trust : null
  const commandHash = currentTrust?.state === 'trusted' ? currentTrust.commandHash : null
  const statusView = useDevServicesStatus({ availability, commandHash, active: isVisible })
  const actions = useDevServicesActions({
    availability,
    commandHash,
    onSettled: statusView.refresh
  })

  const confirmTrust = useCallback(() => {
    if (!availability) {
      return
    }
    void ensureHooksConfirmed(
      () => useAppStore.getState(),
      availability.repoId,
      'services',
      availability.hostId
    )
  }, [availability])

  if (!availability) {
    return (
      <Placeholder>
        <Layers className="size-7 opacity-50" />
        <p>
          {translate(
            'devServices.none',
            "This workspace's project has no services command in orca.yaml."
          )}
        </p>
      </Placeholder>
    )
  }
  if (!currentTrust) {
    return <Placeholder>{translate('devServices.loading', 'Checking services…')}</Placeholder>
  }
  if (currentTrust.state === 'disabled') {
    return (
      <Placeholder>
        <p>
          {translate(
            'devServices.disabled',
            "This project runs only local commands, so orca.yaml's services command is off."
          )}
        </p>
      </Placeholder>
    )
  }
  if (currentTrust.state === 'untrusted') {
    return (
      <Placeholder>
        <ShieldQuestion className="size-7 opacity-50" />
        <p>
          {translate(
            'devServices.trustPrompt',
            'This project lists its services with a command from orca.yaml. Orca runs it on the workspace host:'
          )}
        </p>
        <code className="max-w-full break-all rounded bg-muted px-1.5 py-1 font-mono text-2xs text-foreground">
          {availability.command}
        </code>
        <Button type="button" variant="outline" size="xs" onClick={confirmTrust}>
          {translate('devServices.trust', 'Review and Trust')}
        </Button>
      </Placeholder>
    )
  }
  return (
    <DevServicesBody
      status={statusView.status}
      notice={statusView.notice}
      refreshing={statusView.refreshing}
      onRefresh={statusView.refresh}
      actions={actions}
    />
  )
}
