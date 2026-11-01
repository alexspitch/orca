import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { translate } from '@/i18n/i18n'
import type {
  BuildWebIssueDetail,
  BuildWebIssuePatch,
  BuildWebTester
} from '../../../../shared/build-web-types'
import { personLabel } from './build-web-labels'
import { InlineSelect, PropertyRow } from './BuildWebPropertyControls'
import {
  authorChoices,
  recipientChoices,
  sameRecipients,
  toggledRecipient
} from './issue/issue-author'

const CREATOR = '__creator__'

type Props = {
  detail: BuildWebIssueDetail
  people: readonly BuildWebTester[]
  onOpen: () => void
  disabled: boolean
  onSave: (patch: BuildWebIssuePatch) => Promise<void> | void
}

/**
 * IS-349: «Author», build-web's card's: who is told the task went out, and an external check's
 * default tester. Empty is the task's creator, which the console takes only when that is a person.
 */
export function IssueAuthorRow({
  detail,
  people,
  onOpen,
  disabled,
  onSave
}: Props): React.JSX.Element {
  const label = translate('buildWeb.props.author', 'Author')
  const name = (who: string) => personLabel(who, people)
  return (
    <PropertyRow label={label}>
      <InlineSelect
        label={label}
        value={detail.jira_author || CREATOR}
        disabled={disabled}
        onChange={(v) => void onSave({ jira_author: v === CREATOR ? '' : v })}
        onOpen={onOpen}
        options={[
          {
            value: CREATOR,
            label: translate('buildWeb.props.authorCreator', 'Creator: {{who}}', {
              who: detail.created_by ? name(detail.created_by) : '—'
            })
          },
          ...authorChoices(detail.jira_author ?? '', people, name)
        ]}
      />
    </PropertyRow>
  )
}

/**
 * IS-349: people told the task went out, besides its author — for a task the console filed itself.
 * Ticked in the open menu and saved once it closes; the console's refusal reaches the toast as is.
 */
export function IssueRecipientsRow({
  detail,
  people,
  onOpen,
  disabled,
  onSave
}: Props): React.JSX.Element {
  const saved = detail.notify_recipients ?? []
  const [draft, setDraft] = useState<string[] | null>(null)
  const picked = draft ?? saved
  const label = translate('buildWeb.props.recipients', 'Extra recipients')
  const name = (who: string) => personLabel(who, people)
  const onOpenChange = (open: boolean) => {
    if (open) {
      setDraft(saved)
      onOpen()
      return
    }
    if (draft && !sameRecipients(draft, saved)) {
      void onSave({ notify_recipients: draft })
    }
    setDraft(null)
  }
  return (
    <PropertyRow label={label}>
      <DropdownMenu onOpenChange={onOpenChange}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={disabled}
            aria-label={label}
            className="w-full min-w-0 justify-between font-normal"
          >
            <span className={picked.length ? 'truncate' : 'truncate text-muted-foreground'}>
              {picked.length
                ? picked.map(name).join(', ')
                : translate('buildWeb.props.recipientsNone', 'Nobody')}
            </span>
            <ChevronDown className="opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-80 max-w-72">
          <DropdownMenuLabel className="font-normal">
            {translate(
              'buildWeb.props.recipientsHint',
              'They get the notice that the task went out, together with the author'
            )}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {recipientChoices(picked, people, name).map((choice) => (
            <DropdownMenuCheckboxItem
              key={choice.value}
              checked={picked.includes(choice.value)}
              // Why: the menu stays open so several people are ticked in one go.
              onSelect={(event) => event.preventDefault()}
              onCheckedChange={() => setDraft(toggledRecipient(picked, choice.value))}
            >
              {choice.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </PropertyRow>
  )
}
