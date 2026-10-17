import { useCallback, useEffect, useState } from 'react'
import { ListTodo } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import type { BuildWebConnectionStatus } from '../../../../shared/build-web-types'
import { callBuildWeb } from '../build-web/build-web-client'
import { BuildWebConnectForm } from '../build-web/BuildWebConnect'
import { useBuildWebTarget } from '../build-web/use-build-web-data'
import { IntegrationCardDetails, IntegrationCardShell } from './integration-card-shell'

/** build-web: connect, test, replace the token, disconnect, and bring the sidebar item back. */
export function BuildWebIntegrationCard(): React.JSX.Element {
  const { target } = useBuildWebTarget()
  const showButton = useAppStore((s) => s.settings?.showBuildWebButton === true)
  const showImagesButton = useAppStore((s) => s.settings?.showBuildWebImagesButton === true)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const [status, setStatus] = useState<BuildWebConnectionStatus | null>(null)
  const [replacing, setReplacing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setStatus(await callBuildWeb(target, 'status'))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    }
  }, [target])
  useEffect(() => {
    void load()
  }, [load])

  const run = async (action: () => Promise<void>): Promise<void> => {
    setBusy(true)
    setMessage(null)
    try {
      await action()
    } catch (failure) {
      setMessage(failure instanceof Error ? failure.message : String(failure))
    } finally {
      setBusy(false)
    }
  }
  const test = () =>
    run(async () => {
      const result = await callBuildWeb(target, 'testConnection')
      if (result.ok) {
        setStatus(result.status)
        setMessage(translate('buildWeb.settings.testOk', 'Connected.'))
      } else {
        setMessage(result.error)
      }
    })
  const disconnect = () => run(async () => setStatus(await callBuildWeb(target, 'disconnect')))

  const connected = status?.connected === true
  return (
    <IntegrationCardShell
      icon={<ListTodo className="size-5" />}
      name="Build Web"
      description={translate(
        'buildWeb.settings.description',
        'build-web tasks and images in the Issues page; hand tasks to an agent in a worktree.'
      )}
      statusLabel={
        connected
          ? translate('buildWeb.settings.connected', 'Connected')
          : translate('buildWeb.settings.notConnected', 'Not connected')
      }
      statusTone={connected ? 'connected' : 'neutral'}
      checking={status === null && !message}
      actions={
        connected ? (
          <>
            <Button variant="outline" size="xs" disabled={busy} onClick={() => void test()}>
              {translate('buildWeb.settings.test', 'Test connection')}
            </Button>
            <Button variant="outline" size="xs" disabled={busy} onClick={() => setReplacing(true)}>
              {translate('buildWeb.settings.replace', 'Replace token')}
            </Button>
            <Button variant="ghost" size="xs" disabled={busy} onClick={() => void disconnect()}>
              {translate('buildWeb.settings.disconnect', 'Disconnect')}
            </Button>
          </>
        ) : null
      }
    >
      <IntegrationCardDetails>
        {connected && !replacing ? (
          <dl className="grid grid-cols-[8rem_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
            <dt className="text-muted-foreground">
              {translate('buildWeb.settings.server', 'Server')}
            </dt>
            <dd className="truncate font-mono">{status.baseUrl}</dd>
            <dt className="text-muted-foreground">
              {translate('buildWeb.settings.account', 'Account')}
            </dt>
            <dd className="truncate">{status.login}</dd>
            <dt className="text-muted-foreground">
              {translate('buildWeb.settings.sections', 'Sections')}
            </dt>
            <dd className="truncate">{status.perms.join(', ') || '—'}</dd>
          </dl>
        ) : status !== null ? (
          <BuildWebConnectForm
            target={target}
            initialUrl={status.baseUrl}
            onConnected={(next) => {
              setStatus(next)
              setReplacing(false)
            }}
          />
        ) : null}
        {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
        <label className="flex items-center justify-between gap-3 pt-2 text-sm">
          <span>
            <span className="block">
              {translate('buildWeb.settings.showInSidebar', 'Show in sidebar')}
            </span>
            <span className="block text-xs text-muted-foreground">
              {translate('buildWeb.settings.showInSidebarHint', 'The Issues item next to Tasks')}
            </span>
          </span>
          <Switch
            checked={showButton}
            onCheckedChange={(checked) => void updateSettings({ showBuildWebButton: checked })}
          />
        </label>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>
            <span className="block">
              {translate('buildWeb.settings.showImagesInSidebar', 'Show Images in sidebar')}
            </span>
            <span className="block text-xs text-muted-foreground">
              {translate(
                'buildWeb.settings.showImagesInSidebarHint',
                'With the number of images building right now'
              )}
            </span>
          </span>
          <Switch
            checked={showImagesButton}
            onCheckedChange={(checked) =>
              void updateSettings({ showBuildWebImagesButton: checked })
            }
          />
        </label>
      </IntegrationCardDetails>
    </IntegrationCardShell>
  )
}
