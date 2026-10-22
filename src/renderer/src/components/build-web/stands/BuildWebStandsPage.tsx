import { useEffect } from 'react'
import { ChevronLeft, RefreshCw } from 'lucide-react'
import { useAppStore } from '@/store'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { translate } from '@/i18n/i18n'
import type { BuildWebStandGroup } from '../../../../../shared/build-web-stand-types'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import { useBuildWebStore } from '../build-web-store'
import { useBuildWebStatus, useBuildWebTarget } from '../use-build-web-data'
import { useBuildWebPageEscape } from '../use-build-web-page-escape'
import { BuildWebConnect } from '../BuildWebConnect'
import { BuildWebListState } from '../BuildWebListState'
import { useStandGroups } from './stand-groups-store'
import { StandDirectory } from './StandDirectory'
import { StandFacts } from './StandFacts'
import { StandServicesTab } from './StandServicesTab'
import { StandUsersTab } from './StandUsersTab'
import { useStandHealth } from './use-stand-health'

function StandView({
  target,
  group
}: {
  target: RuntimeClientTarget
  group: BuildWebStandGroup
}): React.JSX.Element {
  const tab = useStandGroups((s) => s.tab)
  const setTab = useStandGroups((s) => s.setTab)
  return (
    <Tabs
      value={tab}
      onValueChange={(value) => setTab(value === 'users' ? 'users' : 'services')}
      className="min-h-0 flex-1"
    >
      <div className="flex flex-col gap-2">
        <StandFacts group={group} />
        <TabsList variant="line">
          <TabsTrigger value="services">
            {translate('buildWeb.stands.tabs.services', 'Services')}
          </TabsTrigger>
          <TabsTrigger value="users">
            {translate('buildWeb.stands.tabs.users', 'Users')}
          </TabsTrigger>
        </TabsList>
      </div>
      {/* Why mounted both: an open log keeps following while the Users tab is in front. */}
      <TabsContent
        value="services"
        forceMount
        hidden={tab !== 'services'}
        className="flex min-h-0 flex-1 flex-col"
      >
        <StandServicesTab key={group.key} target={target} group={group} />
      </TabsContent>
      <TabsContent
        value="users"
        forceMount
        hidden={tab !== 'users'}
        className="flex min-h-0 flex-1 flex-col"
      >
        <StandUsersTab key={group.key} target={target} group={group} />
      </TabsContent>
    </Tabs>
  )
}

function StandsView({
  target,
  contextKey,
  group
}: {
  target: RuntimeClientTarget
  contextKey: string
  group: BuildWebStandGroup | null
}): React.JSX.Element {
  const groups = useStandGroups((s) => (s.contextKey === contextKey ? s.groups : null))
  const error = useStandGroups((s) => s.error)
  const load = useStandGroups((s) => s.load)
  const select = useStandGroups((s) => s.select)
  const refreshes = useStandGroups((s) => s.refreshes)
  const { health } = useStandHealth(target, refreshes)
  useEffect(() => {
    void load(target, contextKey)
  }, [contextKey, load, target])

  if (groups === null) {
    return (
      <BuildWebListState
        kind={error ? 'error' : 'loading'}
        error={error}
        onRetry={() => void load(target, contextKey, true)}
        loadingLabel={translate('buildWeb.stands.loading', 'Loading the stands…')}
      />
    )
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 px-3 pb-4 md:px-5">
      {group ? (
        <StandView key={group.key} target={target} group={group} />
      ) : (
        <StandDirectory target={target} groups={groups} health={health} onSelect={select} />
      )}
    </div>
  )
}

/** build-web's stands: what each runs, its services' logs, and the UI logins on it. */
export default function BuildWebStandsPage(): React.JSX.Element {
  const closePage = useAppStore((s) => s.closeBuildWebStandsPage)
  const { target, contextKey } = useBuildWebTarget()
  const { refreshStatus } = useBuildWebStatus()
  const status = useBuildWebStore((s) => (s.contextKey === contextKey ? s.status : null))
  const error = useBuildWebStore((s) => s.error)
  const setStatus = useBuildWebStore((s) => s.setStatus)
  const group = useStandGroups((s) =>
    s.contextKey === contextKey ? (s.groups?.find((g) => g.key === s.selectedKey) ?? null) : null
  )
  const select = useStandGroups((s) => s.select)
  const load = useStandGroups((s) => s.load)
  const loading = useStandGroups((s) => s.loading)
  // Why: Escape steps back from a stand to the list of stands, then off the page.
  useBuildWebPageEscape(() => (group ? select(null) : closePage()))

  const connected = status?.connected === true
  return (
    <main className="relative flex h-full min-h-0 flex-1 flex-col bg-background pt-5 text-foreground md:pt-6">
      <header
        className="flex shrink-0 items-center gap-2 px-3 pb-3 md:px-5"
        // Why: no stacked titlebar on this page; keep the header clear of the window controls.
        style={{ paddingRight: 'max(0.75rem, var(--window-controls-width, 0px))' }}
      >
        {group ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={translate('buildWeb.stands.back', 'All stands')}
            onClick={() => select(null)}
          >
            <ChevronLeft />
          </Button>
        ) : null}
        <h1 className="truncate text-base leading-8 font-semibold">
          {group?.name ?? translate('buildWeb.stands.title', 'Stands')}
        </h1>
        <div className="flex-1" />
        {connected ? (
          <>
            <span className="truncate text-xs text-muted-foreground">
              {status.login} · {status.baseUrl?.replace(/^https?:\/\//, '')}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={translate('buildWeb.stands.reloadList', 'Read the stands again')}
              disabled={loading}
              onClick={() => void load(target, contextKey, true)}
            >
              <RefreshCw />
            </Button>
          </>
        ) : null}
      </header>
      {status === null ? (
        <BuildWebListState
          kind={error ? 'error' : 'loading'}
          error={error}
          onRetry={() => void refreshStatus()}
          loadingLabel={translate('buildWeb.stands.loading', 'Loading the stands…')}
        />
      ) : !connected ? (
        <BuildWebConnect target={target} onConnected={(next) => setStatus(contextKey, next)} />
      ) : (
        // Why no check of status.perms: they are saved at connect time and go stale; the console's
        // own refusal (403, naming the Stands section) is what the page shows instead.
        <StandsView key={contextKey} target={target} contextKey={contextKey} group={group} />
      )}
    </main>
  )
}
