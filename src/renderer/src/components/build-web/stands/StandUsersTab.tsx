import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, LogIn, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type {
  BuildWebStandAccount,
  BuildWebStandGroup
} from '../../../../../shared/build-web-stand-types'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import { callBuildWeb } from '../build-web-client'
import { BuildWebListState } from '../BuildWebListState'
import {
  accountLoginBlockedBy,
  openStandLogin,
  standLoginBlockedBy,
  useStandLoginContext
} from './stand-login'
import { StandProductChip, standProductOf } from './StandProductChip'

const message = (failure: unknown) => (failure instanceof Error ? failure.message : String(failure))

/** The UI logins on the stand, as build-web keeps them; read-only, each one a tab away. */
export function StandUsersTab({
  target,
  group
}: {
  target: RuntimeClientTarget
  group: BuildWebStandGroup
}): React.JSX.Element {
  const [accounts, setAccounts] = useState<BuildWebStandAccount[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [opening, setOpening] = useState<string | null>(null)
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({})
  const [product, setProduct] = useState('all')
  const context = useStandLoginContext(target)
  const blocked = standLoginBlockedBy(context)
  const cardIds = group.cards.map((c) => c.id).join(',')
  const latest = useRef(0)

  const load = useCallback(async () => {
    const mine = ++latest.current
    try {
      const result = await callBuildWeb(target, 'standAccounts', { standIds: cardIds.split(',') })
      if (mine !== latest.current) {
        return
      }
      if (result.ok) {
        setAccounts(result.value)
        setError(null)
      } else {
        setError(result.error)
      }
    } catch (failure) {
      if (mine === latest.current) {
        setError(message(failure))
      }
    }
  }, [cardIds, target])
  useEffect(() => {
    setAccounts(null)
    void load()
  }, [load])

  const logIn = async (account: BuildWebStandAccount): Promise<void> => {
    if (!context.worktreeId) {
      return
    }
    setOpening(account.id)
    setRowErrors(({ [account.id]: _previous, ...rest }) => rest)
    try {
      const failed = await openStandLogin(target, context.worktreeId, account.id)
      if (failed) {
        setRowErrors((current) => ({ ...current, [account.id]: failed }))
      }
    } catch (failure) {
      setRowErrors((current) => ({ ...current, [account.id]: message(failure) }))
    } finally {
      setOpening(null)
    }
  }

  if (accounts === null) {
    return (
      <BuildWebListState
        kind={error ? 'error' : 'loading'}
        error={error}
        onRetry={() => void load()}
        loadingLabel={translate('buildWeb.stands.users.loading', 'Loading the logins…')}
      />
    )
  }
  const cardOf = (id: string) => group.cards.find((c) => c.id === id)
  const products = [
    ...new Set(group.cards.map((c) => standProductOf(c.product)).filter((p) => p !== null))
  ]
  const several = products.length > 1
  const shown =
    several && product !== 'all'
      ? accounts.filter((a) => cardOf(a.standId)?.product === product)
      : accounts
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-center gap-2">
        {several ? (
          <Select value={product} onValueChange={setProduct}>
            <SelectTrigger
              size="sm"
              aria-label={translate('buildWeb.stands.users.product', 'Application')}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {translate('buildWeb.stands.users.allProducts', 'All applications')}
              </SelectItem>
              {products.map((p) => (
                <SelectItem key={p} value={p}>
                  <StandProductChip product={p} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        <span className="text-xs text-muted-foreground">
          {blocked ??
            translate(
              'buildWeb.stands.users.hint',
              'Log in opens the stand in Orca’s browser, in a profile of its own per login.'
            )}
        </span>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={translate('buildWeb.stands.refresh', 'Read again')}
          onClick={() => void load()}
        >
          <RefreshCw />
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
      {shown.length === 0 ? (
        <p className="px-3 py-10 text-center text-sm text-muted-foreground">
          {accounts.length === 0
            ? translate(
                'buildWeb.stands.users.none',
                'No UI logins on this stand. They are added in build-web, on the stand’s card.'
              )
            : translate(
                'buildWeb.stands.users.noneForProduct',
                'No UI logins for this application.'
              )}
        </p>
      ) : (
        <div className="scrollbar-sleek min-h-0 overflow-auto rounded-md border border-border">
          <table className="w-full min-w-[760px] table-fixed border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-background">
              <tr className="border-b border-border text-left text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
                <th className="w-[34%] py-2 pl-3">
                  {translate('buildWeb.stands.users.account', 'Login')}
                </th>
                <th className="w-[14%] py-2">{translate('buildWeb.stands.users.role', 'Role')}</th>
                <th className="py-2">{translate('buildWeb.stands.users.project', 'Project')}</th>
                {several ? (
                  <th className="w-[14%] py-2">
                    {translate('buildWeb.stands.users.ui', 'Application')}
                  </th>
                ) : null}
                <th className="w-44 py-2 pr-3" />
              </tr>
            </thead>
            <tbody>
              {shown.map((account) => {
                const card = cardOf(account.standId)
                const reason = accountLoginBlockedBy(account, card)
                const rowError = rowErrors[account.id]
                return (
                  <tr
                    key={account.id}
                    className="border-b border-border/60 align-top last:border-b-0 hover:bg-accent"
                  >
                    <td className="max-w-0 py-2 pl-3">
                      <span className="block truncate">{account.description}</span>
                      <span className="block truncate font-mono text-xs text-muted-foreground">
                        {account.email}
                      </span>
                    </td>
                    <td className="max-w-0 py-2">
                      <span className="block truncate text-xs">{account.role || '—'}</span>
                    </td>
                    <td className="max-w-0 py-2">
                      <span className="block truncate text-xs">{account.projectName || '—'}</span>
                    </td>
                    {several ? (
                      <td className="max-w-0 py-2">
                        <StandProductChip product={card?.product ?? null} />
                      </td>
                    ) : null}
                    <td className="py-1.5 pr-3">
                      <span className="flex flex-col items-end gap-1">
                        <Button
                          variant="outline"
                          size="xs"
                          disabled={blocked !== null || reason !== null || opening !== null}
                          onClick={() => void logIn(account)}
                        >
                          {opening === account.id ? (
                            <Loader2 className="animate-spin" />
                          ) : (
                            <LogIn />
                          )}
                          {translate('buildWeb.stands.users.logIn', 'Log in')}
                        </Button>
                        {reason || rowError ? (
                          <span
                            className={cn(
                              'text-right text-2xs',
                              rowError ? 'text-destructive' : 'text-muted-foreground'
                            )}
                          >
                            {rowError ?? reason}
                          </span>
                        ) : null}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
