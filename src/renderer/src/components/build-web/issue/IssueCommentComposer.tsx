import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useConfirmationDialog } from '@/components/confirmation-dialog-context'
import { translate } from '@/i18n/i18n'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import type { BuildWebCommentOutcome } from '../../../../../shared/build-web-types'
import type { IssueDetailState } from '../use-build-web-issue-detail'
import { callBuildWeb } from '../build-web-client'

type Channel = 'console' | 'telegram'

function reportOutcome(outcome: BuildWebCommentOutcome): void {
  if (outcome.jira && !outcome.jira.ok) {
    toast.error(
      translate('buildWeb.card.commentNotInJira', 'Saved, but not posted to Jira: {{error}}', {
        error: outcome.jira.error
      })
    )
  }
  if (!outcome.telegram) {
    return
  }
  if (!outcome.telegram.ok) {
    toast.error(
      translate(
        'buildWeb.card.commentNotInTelegram',
        'Saved, but not sent to Telegram: {{error}}',
        {
          error: outcome.telegram.error
        }
      )
    )
    return
  }
  toast.success(
    outcome.telegram.awaiting
      ? translate(
          'buildWeb.card.commentSentTelegramAwaiting',
          'Sent to the assignee in Telegram; the task awaits their answer.'
        )
      : translate('buildWeb.card.commentSentTelegram', 'Sent to the assignee in Telegram.')
  )
}

/** A new comment for the console, or a question to the assignee in Telegram, as build-web offers. */
export function IssueCommentComposer({
  target,
  state
}: {
  target: RuntimeClientTarget
  state: IssueDetailState
}): React.JSX.Element | null {
  const confirm = useConfirmationDialog()
  const [body, setBody] = useState('')
  const [jira, setJira] = useState(false)
  // Why not kept between cards: a question in Telegram moves the task, so it is chosen each time.
  const [channel, setChannel] = useState<Channel>('console')
  const [sending, setSending] = useState(false)
  const detail = state.detail
  if (!detail) {
    return null
  }
  const toTelegram = detail.telegram_available && channel === 'telegram'
  const send = async (): Promise<void> => {
    if (jira && detail.jira_key) {
      const accepted = await confirm({
        title: translate(
          'buildWeb.card.commentJiraTitle',
          'Post this comment to Jira {{key}} too?',
          { key: detail.jira_key }
        ),
        confirmLabel: translate('buildWeb.card.send', 'Send')
      })
      if (!accepted) {
        return
      }
    }
    setSending(true)
    try {
      const result = await callBuildWeb(target, 'addComment', {
        id: detail.id,
        body: body.trim(),
        jira: jira && Boolean(detail.jira_key),
        // Why only when chosen: the flag needs a server that knows it, a console comment does not.
        ...(toTelegram ? { telegram: true } : {})
      })
      if (result.ok) {
        setBody('')
        setChannel('console')
        state.reload()
        reportOutcome(result.value)
      } else {
        toast.error(result.error)
      }
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : String(failure))
    } finally {
      setSending(false)
    }
  }
  return (
    <div className="flex flex-col gap-2">
      {detail.telegram_available ? (
        <ToggleGroup
          type="single"
          variant="segmented"
          size="xs"
          spacing={1}
          value={channel}
          aria-label={translate('buildWeb.card.commentChannel', 'Where the comment goes')}
          onValueChange={(next) => {
            if (next === 'console' || next === 'telegram') {
              setChannel(next)
            }
          }}
          className="self-start"
        >
          <ToggleGroupItem value="console">
            {translate('buildWeb.card.channelConsole', 'Console')}
          </ToggleGroupItem>
          <ToggleGroupItem value="telegram">
            {translate('buildWeb.card.channelTelegram', 'Telegram')}
          </ToggleGroupItem>
        </ToggleGroup>
      ) : null}
      {toTelegram ? (
        <p className="text-xs text-muted-foreground">
          {translate(
            'buildWeb.card.telegramHint',
            'Goes to the assignee in Telegram, and the task moves to «Awaiting response». Their reply to it is written here.'
          )}
        </p>
      ) : null}
      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder={translate('buildWeb.card.commentPlaceholder', 'Comment…')}
        aria-label={translate('buildWeb.card.comment', 'Comment')}
        rows={3}
        maxLength={4000}
      />
      <div className="flex items-center gap-3">
        {detail.jira_key ? (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              emphasis="strong"
              checked={jira}
              onCheckedChange={(v) => setJira(v === true)}
            />
            {translate('buildWeb.card.alsoJira', 'and in Jira')}
          </label>
        ) : null}
        <div className="flex-1" />
        <Button size="sm" disabled={sending || !body.trim()} onClick={() => void send()}>
          {toTelegram
            ? translate('buildWeb.card.sendTelegram', 'Send to Telegram')
            : translate('buildWeb.card.send', 'Send')}
        </Button>
      </div>
    </div>
  )
}
