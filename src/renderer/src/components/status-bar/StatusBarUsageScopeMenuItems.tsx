import { Gauge, Users } from 'lucide-react'
import React from 'react'
import {
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger
} from '@/components/ui/dropdown-menu'
import { useConnectedRuntimeServers } from '@/hooks/use-connected-runtime-servers'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '../../store'
import type { StatusBarUsageHost } from '../../../../shared/status-bar-usage-scope'

const ENVIRONMENT_PREFIX = 'environment:'

function hostValue(host: StatusBarUsageHost): string {
  return host.kind === 'environment' ? `${ENVIRONMENT_PREFIX}${host.environmentId}` : host.kind
}

function parseHostValue(value: string): StatusBarUsageHost {
  if (value.startsWith(ENVIRONMENT_PREFIX)) {
    return { kind: 'environment', environmentId: value.slice(ENVIRONMENT_PREFIX.length) }
  }
  return value === 'local' ? { kind: 'local' } : { kind: 'auto' }
}

/** Whose accounts the footer's usage meters show, and whether each account gets its own. */
export function StatusBarUsageScopeMenuItems(): React.JSX.Element {
  const scope = useAppStore((s) => s.statusBarUsageScope)
  const setScope = useAppStore((s) => s.setStatusBarUsageScope)
  const connected = useConnectedRuntimeServers()
  const chosenId = scope.host.kind === 'environment' ? scope.host.environmentId : null
  // Why: a chosen server that disconnected stays listed, so the choice reads as what it is.
  const chosenName = useAppStore((s) =>
    chosenId && !connected.some((server) => server.id === chosenId)
      ? (s.runtimeEnvironments.find((environment) => environment.id === chosenId)?.name ?? null)
      : null
  )
  const servers =
    chosenId && chosenName !== null
      ? [...connected, { id: chosenId, label: chosenName }]
      : connected
  const hostLabels: Record<string, string> = {
    auto: translate(
      'auto.components.status.bar.StatusBar.usageHostAuto',
      'Focused workspace’s host'
    ),
    local: translate('auto.components.status.bar.StatusBar.usageHostLocal', 'This computer'),
    ...Object.fromEntries(
      servers.map((server) => [`${ENVIRONMENT_PREFIX}${server.id}`, server.label])
    )
  }
  const value = hostValue(scope.host)

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <Gauge className="size-3.5" />
          {translate(
            'auto.components.status.bar.StatusBar.usageHostMenu',
            'Usage from: {{value0}}',
            {
              value0: hostLabels[value] ?? hostLabels.auto
            }
          )}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <DropdownMenuRadioGroup
            value={value}
            onValueChange={(next) => setScope({ ...scope, host: parseHostValue(next) })}
          >
            {Object.entries(hostLabels).map(([option, label]) => (
              <DropdownMenuRadioItem key={option} value={option}>
                {label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuCheckboxItem
        checked={scope.allAccounts}
        onCheckedChange={(checked) => setScope({ ...scope, allAccounts: checked === true })}
      >
        <Users className="size-3.5" />
        {translate(
          'auto.components.status.bar.StatusBar.usageAllAccounts',
          'All Claude & Codex Accounts'
        )}
      </DropdownMenuCheckboxItem>
    </>
  )
}
