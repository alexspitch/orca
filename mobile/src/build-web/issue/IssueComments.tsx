import { useState } from 'react'
import { StyleSheet, Text, TextInput, View } from 'react-native'
import { Pencil, Trash2 } from 'lucide-react-native'
import type {
  BuildWebComment,
  BuildWebIssueDetail,
  BuildWebJiraOutcome
} from '../../../../src/shared/build-web-types'
import { MobileMarkdown } from '../../components/MobileMarkdown'
import { colors, spacing } from '../../theme/mobile-theme'
import { loginOf } from '../build-web-labels'
import { buildWebErrorMessage, callBuildWeb } from '../build-web-operations'
import { useBuildWebScreen, type BuildWebScreen } from '../build-web-screen-context'
import { BuildWebToneChip } from '../BuildWebToneChip'
import { CardButton, MutedText, SaveCancelRow, ui } from './issue-card-ui'
import { IssueAttachments } from './IssueAttachments'
import type { IssueConfirm } from './use-issue-confirm'

function notifyJiraNote(notify: BuildWebScreen['notify'], jira: BuildWebJiraOutcome | null): void {
  if (jira && !jira.ok) {
    notify(`Saved, but Jira was not updated: ${jira.error}`, 'error')
  }
}

/** Where a comment went to or came from, beside its author, as build-web marks it. */
function ChannelMark({ channel }: { channel: BuildWebComment['channel'] }) {
  if (!channel) {
    return null
  }
  return (
    <BuildWebToneChip label={channel === 'telegram' ? 'Telegram' : 'from Telegram'} tone="sky" />
  )
}

/** One comment; its author may correct it or take it back, as build-web allows. */
function CommentItem({
  detail,
  comment: c,
  mine,
  confirm,
  onChanged
}: {
  detail: BuildWebIssueDetail
  comment: BuildWebComment
  mine: boolean
  confirm: IssueConfirm
  onChanged: () => void
}) {
  const { client, notify } = useBuildWebScreen()
  const [draft, setDraft] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    const body = (draft ?? '').trim()
    if (!body || body === c.body) {
      setDraft(null)
      return
    }
    setBusy(true)
    try {
      const result = await callBuildWeb(client, 'editComment', {
        id: detail.id,
        commentId: c.id,
        body
      })
      if (result.ok) {
        setDraft(null)
        notifyJiraNote(notify, result.value.jira)
        onChanged()
      } else {
        notify(result.error, 'error')
      }
    } catch (failure) {
      notify(buildWebErrorMessage(failure), 'error')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    const accepted = await confirm({
      title: 'Delete this comment?',
      message: c.jira_sync ? 'It is deleted from the Jira issue too.' : undefined,
      confirmLabel: 'Delete',
      destructive: true
    })
    if (!accepted) {
      return
    }
    setBusy(true)
    try {
      const result = await callBuildWeb(client, 'deleteComment', {
        id: detail.id,
        commentId: c.id
      })
      if (result.ok) {
        notifyJiraNote(notify, result.value.jira)
        onChanged()
      } else {
        notify(result.error, 'error')
      }
    } catch (failure) {
      notify(buildWebErrorMessage(failure), 'error')
    } finally {
      setBusy(false)
    }
  }

  const meta = [
    loginOf(c.author),
    new Date(c.created_at).toLocaleString(),
    c.edited_at ? 'edited' : '',
    c.jira_sync ? 'Jira' : ''
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <View style={styles.item}>
      <View style={ui.row}>
        <View style={[ui.wrapRow, styles.meta]}>
          <MutedText>{meta}</MutedText>
          <ChannelMark channel={c.channel} />
        </View>
        {mine && draft === null ? (
          <>
            <CardButton
              variant="ghost"
              icon={Pencil}
              disabled={busy}
              accessibilityLabel="Edit the comment"
              onPress={() => setDraft(c.body)}
            />
            <CardButton
              variant="ghost"
              icon={Trash2}
              disabled={busy}
              accessibilityLabel="Delete"
              onPress={() => void remove()}
            />
          </>
        ) : null}
      </View>
      {draft === null ? (
        <MobileMarkdown content={c.body} />
      ) : (
        <View style={styles.editor}>
          <TextInput
            autoFocus
            multiline
            maxLength={4000}
            value={draft}
            onChangeText={setDraft}
            accessibilityLabel="Edit the comment"
            placeholderTextColor={colors.textMuted}
            style={[ui.input, ui.multiline]}
          />
          <SaveCancelRow
            disabled={busy || !draft.trim()}
            onCancel={() => setDraft(null)}
            onSave={() => void save()}
          />
        </View>
      )}
      <IssueAttachments
        issueId={detail.id}
        files={detail.files.filter((file) => file.comment_id === c.id)}
      />
    </View>
  )
}

/** The task's comments; the ones the token owner wrote can be corrected or deleted. */
export function IssueComments({
  detail,
  confirm,
  onChanged
}: {
  detail: BuildWebIssueDetail
  confirm: IssueConfirm
  onChanged: () => void
}) {
  const { status } = useBuildWebScreen()
  const me = status.login?.toLowerCase() ?? null
  if (detail.comments.length === 0) {
    return <Text style={ui.muted}>No comments.</Text>
  }
  return (
    <View style={styles.list}>
      {detail.comments.map((c) => (
        <CommentItem
          key={c.id}
          detail={detail}
          comment={c}
          mine={me !== null && c.author.toLowerCase() === me}
          confirm={confirm}
          onChanged={onChanged}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
  item: { gap: spacing.xs },
  meta: { flex: 1, minWidth: 0, gap: spacing.xs },
  editor: { gap: spacing.sm }
})
