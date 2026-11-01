import { useRef, useState } from 'react'
import { Text } from 'react-native'
import type {
  BuildWebIssueDetail,
  BuildWebIssuePatch,
  BuildWebTester
} from '../../../../src/shared/build-web-types'
import {
  authorChoices,
  recipientChoices,
  sameRecipients,
  toggledRecipient
} from '../../../../src/renderer/src/components/build-web/issue/issue-author'
import { personLabel } from '../build-web-labels'
import { IssueCheckSheet } from '../list/IssueCheckSheet'
import { ui } from './issue-card-ui'
import { PropertyRow, PropertySelect, PropertyTrigger } from './IssuePropertySelect'

const CREATOR = '__creator__'

type Props = {
  detail: BuildWebIssueDetail
  people: readonly BuildWebTester[]
  onOpen: () => void
  disabled: boolean
  onSave: (patch: BuildWebIssuePatch) => Promise<unknown> | void
}

/** The desktop's IssueAuthorRow (IS-349): who is told the task went out; empty is its creator. */
export function IssueAuthorRow({ detail, people, onOpen, disabled, onSave }: Props) {
  const name = (who: string) => personLabel(who, people)
  return (
    <PropertyRow label="Author">
      <PropertySelect
        label="Author"
        value={detail.jira_author || CREATOR}
        disabled={disabled}
        onOpen={onOpen}
        options={[
          {
            value: CREATOR,
            label: `Creator: ${detail.created_by ? name(detail.created_by) : '—'}`
          },
          ...authorChoices(detail.jira_author ?? '', people, name)
        ]}
        onChange={(v) => void onSave({ jira_author: v === CREATOR ? '' : v })}
      />
    </PropertyRow>
  )
}

/** The desktop's IssueRecipientsRow (IS-349): ticked in the sheet, saved once it closes. */
export function IssueRecipientsRow({ detail, people, onOpen, disabled, onSave }: Props) {
  const saved = detail.notify_recipients ?? []
  // Why a ref too: the sheet's reset and its close run in one press, before a re-render.
  const draftRef = useRef<string[] | null>(null)
  const [draft, setDraftState] = useState<string[] | null>(null)
  const setDraft = (next: string[] | null) => {
    draftRef.current = next
    setDraftState(next)
  }
  const picked = draft ?? saved
  const name = (who: string) => personLabel(who, people)
  const close = () => {
    const next = draftRef.current
    setDraft(null)
    if (next && !sameRecipients(next, saved)) {
      void onSave({ notify_recipients: next })
    }
  }
  return (
    <PropertyRow label="Extra recipients">
      <PropertyTrigger
        label="Extra recipients"
        disabled={disabled}
        onPress={() => {
          onOpen()
          setDraft(saved)
        }}
      >
        <Text style={picked.length ? ui.body : ui.muted} numberOfLines={1}>
          {picked.length ? picked.map(name).join(', ') : 'Nobody'}
        </Text>
      </PropertyTrigger>
      <IssueCheckSheet
        visible={draft !== null}
        title="Extra recipients"
        subtitle="They get the notice that the task went out, together with the author"
        resetLabel="Nobody"
        options={recipientChoices(picked, people, name)}
        selected={new Set(picked)}
        onToggle={(who) => setDraft(toggledRecipient(draftRef.current ?? saved, who))}
        onReset={() => setDraft([])}
        onClose={close}
      />
    </PropertyRow>
  )
}
