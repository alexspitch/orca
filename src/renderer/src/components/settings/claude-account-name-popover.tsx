import { useState } from 'react'
import { Loader2, Pencil } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { renameClaudeProviderAccount } from '@/runtime/runtime-provider-accounts-client'
import type { ClaudeManagedAccountSummary } from '../../../../shared/managed-account-types'
import type { RuntimeClientTarget } from '../../../../shared/runtime-client-target'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import type { ClaudeAccountActionRunner } from './accounts-pane-types'

/** Names a saved Claude account; an empty name shows its email again. */
export function ClaudeAccountNamePopover({
  owner,
  account,
  disabled,
  busy,
  runClaudeAccountAction
}: {
  owner: RuntimeClientTarget
  account: Pick<ClaudeManagedAccountSummary, 'id' | 'email' | 'label'>
  disabled: boolean
  busy: boolean
  runClaudeAccountAction: ClaudeAccountActionRunner
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const inputId = `claude-account-name-${account.id}`

  const submit = async (): Promise<void> => {
    let renamed = false
    await runClaudeAccountAction(`rename:${account.id}`, async () => {
      const next = await renameClaudeProviderAccount(owner, account.id, label.trim())
      renamed = true
      return next
    })
    if (renamed) {
      setOpen(false)
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        // Why on open: the row's name may have changed from another window since the last edit.
        if (next) {
          setLabel(account.label ?? '')
        }
        setOpen(next)
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="xs"
          disabled={disabled}
          onClick={(event) => event.stopPropagation()}
          className="h-6 px-2 text-muted-foreground hover:text-foreground"
        >
          {busy ? <Loader2 className="size-3 animate-spin" /> : <Pencil className="size-3" />}
          {translate('accounts.claude.rename', 'Rename')}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" side="bottom" sideOffset={6} className="w-80">
        <form
          className="space-y-2 p-3"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <div className="space-y-1">
            <Label htmlFor={inputId}>
              {translate('accounts.claude.nameTitle', 'Account name')}
            </Label>
            <p className="text-xs text-muted-foreground">
              {translate(
                'accounts.claude.nameDescription',
                'Shown instead of {{value0}}. Leave it empty to show the email.',
                { value0: account.email }
              )}
            </p>
          </div>
          <Input
            id={inputId}
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            maxLength={120}
            autoFocus
          />
          <div className="flex justify-end gap-1.5">
            <Button type="button" variant="ghost" size="xs" onClick={() => setOpen(false)}>
              {translate('auto.components.settings.AccountsPane.dbb9626ed1', 'Cancel')}
            </Button>
            <Button type="submit" size="xs" disabled={busy}>
              {translate('accounts.claude.nameSave', 'Save')}
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  )
}
