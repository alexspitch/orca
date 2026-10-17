import { useState } from 'react'
import { ListTodo } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { translate } from '@/i18n/i18n'
import type { BuildWebConnectionStatus } from '../../../../shared/build-web-types'
import type { RuntimeClientTarget } from '../../../../shared/runtime-client-target'
import { callBuildWeb } from './build-web-client'

export const DEFAULT_BUILD_WEB_URL = 'https://tw.spitch-dev.ai:8585'

/** URL and token form, shared by the Issues page's empty state and the Settings card. */
export function BuildWebConnectForm({
  target,
  initialUrl,
  onConnected
}: {
  target: RuntimeClientTarget
  initialUrl?: string | null
  onConnected: (status: BuildWebConnectionStatus) => void
}): React.JSX.Element {
  const [baseUrl, setBaseUrl] = useState(initialUrl || DEFAULT_BUILD_WEB_URL)
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const result = await callBuildWeb(target, 'connect', { baseUrl, token })
      if (result.ok) {
        setToken('')
        onConnected(result.status)
      } else {
        setError(result.error)
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="flex w-full max-w-md flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="build-web-url">
          {translate('buildWeb.connect.url', 'build-web address')}
        </Label>
        <Input
          id="build-web-url"
          value={baseUrl}
          onChange={(event) => setBaseUrl(event.target.value)}
          placeholder={DEFAULT_BUILD_WEB_URL}
          autoComplete="url"
          spellCheck={false}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="build-web-token">{translate('buildWeb.connect.token', 'API token')}</Label>
        <Input
          id="build-web-token"
          type="password"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          placeholder={translate('buildWeb.connect.tokenPlaceholder', 'bwt_…')}
          autoComplete="off"
          spellCheck={false}
        />
        <p className="text-xs text-muted-foreground">
          {translate(
            'buildWeb.connect.tokenHint',
            'Issue a dedicated token for Orca in build-web: the key icon in the header → My API tokens. Everyone using this Orca host acts as that account.'
          )}
        </p>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
        disabled={busy || !token.trim() || !baseUrl.trim()}
        className="self-start"
      >
        {busy
          ? translate('buildWeb.connect.connecting', 'Connecting…')
          : translate('buildWeb.connect.submit', 'Connect')}
      </Button>
    </form>
  )
}

export function BuildWebConnect(props: {
  target: RuntimeClientTarget
  onConnected: (status: BuildWebConnectionStatus) => void
}): React.JSX.Element {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-10">
      <div className="flex flex-col items-center gap-2 text-center">
        <ListTodo className="size-8 text-muted-foreground" strokeWidth={1.5} />
        <h2 className="text-base font-semibold">
          {translate('buildWeb.connect.title', 'Connect build-web')}
        </h2>
        <p className="max-w-md text-sm text-muted-foreground">
          {translate(
            'buildWeb.connect.description',
            'See your build-web tasks and images here, and hand tasks to an agent in a worktree.'
          )}
        </p>
      </div>
      <BuildWebConnectForm {...props} />
    </div>
  )
}
