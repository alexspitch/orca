import { useState } from 'react'
import { StyleSheet, Text, TextInput, View } from 'react-native'
import type { BuildWebCommentOutcome } from '../../../../src/shared/build-web-types'
import { BUILD_WEB_COMMENT_TELEGRAM_RUNTIME_CAPABILITY } from '../../../../src/shared/build-web-capability'
import { MobileSegmentedControl } from '../../components/MobileSegmentedControl'
import { MobileSwitch } from '../../components/MobileSwitch'
import { colors, spacing } from '../../theme/mobile-theme'
import { buildWebErrorMessage, callBuildWeb } from '../build-web-operations'
import { useBuildWebScreen, type BuildWebScreen } from '../build-web-screen-context'
import { CardButton, MutedText, ui } from './issue-card-ui'
import type { IssueConfirm } from './use-issue-confirm'
import type { IssueDetailState } from './use-issue-detail'

type Channel = 'console' | 'telegram'

const CHANNELS = [
  { value: 'console', label: 'Console' },
  { value: 'telegram', label: 'Telegram' }
] as const

function reportOutcome(notify: BuildWebScreen['notify'], outcome: BuildWebCommentOutcome): void {
  if (outcome.jira && !outcome.jira.ok) {
    notify(`Saved, but not posted to Jira: ${outcome.jira.error}`, 'error')
  }
  if (!outcome.telegram) {
    return
  }
  if (!outcome.telegram.ok) {
    notify(`Saved, but not sent to Telegram: ${outcome.telegram.error}`, 'error')
    return
  }
  notify(
    outcome.telegram.awaiting
      ? 'Sent to the assignee in Telegram; the task awaits their answer.'
      : 'Sent to the assignee in Telegram.',
    'success'
  )
}

/** A new comment for the console, or a question to the assignee in Telegram, as build-web offers. */
export function IssueCommentComposer({
  state,
  confirm
}: {
  state: IssueDetailState
  confirm: IssueConfirm
}) {
  const { client, hostCapabilities, notify } = useBuildWebScreen()
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
    if (toTelegram && !hostCapabilities.includes(BUILD_WEB_COMMENT_TELEGRAM_RUNTIME_CAPABILITY)) {
      notify(
        'This Orca server cannot send a comment to Telegram yet. Update the server, or send it to the console.',
        'error'
      )
      return
    }
    if (jira && detail.jira_key) {
      const accepted = await confirm({
        title: `Post this comment to Jira ${detail.jira_key} too?`,
        confirmLabel: 'Send'
      })
      if (!accepted) {
        return
      }
    }
    setSending(true)
    try {
      const result = await callBuildWeb(client, 'addComment', {
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
        reportOutcome(notify, result.value)
      } else {
        notify(result.error, 'error')
      }
    } catch (failure) {
      notify(buildWebErrorMessage(failure), 'error')
    } finally {
      setSending(false)
    }
  }
  return (
    <View style={styles.composer}>
      {detail.telegram_available ? (
        <MobileSegmentedControl
          segments={CHANNELS}
          selected={channel}
          onSelect={setChannel}
          style={styles.channels}
        />
      ) : null}
      {toTelegram ? (
        <MutedText>
          Goes to the assignee in Telegram, and the task moves to «Awaiting response». Their reply
          to it is written here.
        </MutedText>
      ) : null}
      <TextInput
        multiline
        value={body}
        onChangeText={setBody}
        placeholder="Comment…"
        placeholderTextColor={colors.textMuted}
        accessibilityLabel="Comment"
        maxLength={4000}
        style={[ui.input, ui.multiline]}
      />
      <View style={ui.row}>
        {detail.jira_key ? (
          <View style={ui.row}>
            <MobileSwitch value={jira} onValueChange={setJira} accessibilityLabel="and in Jira" />
            <Text style={ui.body}>and in Jira</Text>
          </View>
        ) : null}
        <View style={ui.grow} />
        <CardButton
          variant="primary"
          label={toTelegram ? 'Send to Telegram' : 'Send'}
          disabled={sending || !body.trim()}
          onPress={() => void send()}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  composer: { gap: spacing.sm },
  channels: { alignSelf: 'flex-start' }
})
