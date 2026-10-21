import { useState } from 'react'
import { FolderInput, Loader2 } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { addClaudeProviderAccountFromFolder } from '@/runtime/runtime-provider-accounts-client'
import type { RuntimeClientTarget } from '../../../../shared/runtime-client-target'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import type { ClaudeAccountActionRunner } from './accounts-pane-types'

/** Saves a Claude folder already signed in on the account host, in place of a sign-in. */
export function ClaudeFolderAccountPopover({
  owner,
  hostLabel,
  disabled,
  busy,
  runClaudeAccountAction
}: {
  owner: RuntimeClientTarget
  hostLabel: string
  disabled: boolean
  busy: boolean
  runClaudeAccountAction: ClaudeAccountActionRunner
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [configDir, setConfigDir] = useState('')
  const [label, setLabel] = useState('')

  const submit = async (): Promise<void> => {
    let added = false
    // Why the flag: the runner reports failures itself, and the fields stay for a correction.
    await runClaudeAccountAction('adding-folder', async () => {
      const next = await addClaudeProviderAccountFromFolder(owner, configDir.trim(), label.trim())
      added = true
      return next
    })
    if (added) {
      setOpen(false)
      setConfigDir('')
      setLabel('')
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="xs" disabled={disabled}>
          {busy ? <Loader2 className="size-3 animate-spin" /> : <FolderInput className="size-3" />}
          {translate('accounts.claude.addFolder', 'Add Folder')}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" side="bottom" sideOffset={6} className="w-96">
        <form
          className="space-y-3 p-3"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <div className="space-y-2">
            <div className="space-y-1">
              <Label htmlFor="claude-folder-account-path">
                {translate('accounts.claude.addFolderLabel', 'Signed-in Claude folder')}
              </Label>
              <p className="text-xs text-muted-foreground">
                {translate(
                  'accounts.claude.addFolderDescription',
                  'A CLAUDE_CONFIG_DIR folder on {{value0}} that is already signed in. Orca runs this account in it and adds its hooks there, but never deletes the folder.',
                  { value0: hostLabel }
                )}
              </p>
            </div>
            <Input
              id="claude-folder-account-path"
              value={configDir}
              onChange={(event) => setConfigDir(event.target.value)}
              placeholder={translate('accounts.claude.addFolderPlaceholder', '~/.claude-work')}
              spellCheck={false}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="claude-folder-account-name">
              {translate('accounts.claude.nameLabel', 'Name (optional)')}
            </Label>
            <Input
              id="claude-folder-account-name"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder={translate('accounts.claude.namePlaceholder', 'Shows the email if empty')}
              maxLength={120}
            />
          </div>
          <div className="flex justify-end gap-1.5">
            <Button type="button" variant="ghost" size="xs" onClick={() => setOpen(false)}>
              {translate('auto.components.settings.AccountsPane.dbb9626ed1', 'Cancel')}
            </Button>
            <Button type="submit" size="xs" disabled={busy || !configDir.trim()}>
              {translate('accounts.claude.addFolderSubmit', 'Add Account')}
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  )
}
