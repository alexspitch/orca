import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Archive, ExternalLink, Pencil, SquareTerminal } from 'lucide-react-native'
import type {
  BuildWebIssueDetail,
  BuildWebIssuePatch
} from '../../../../src/shared/build-web-types'
import { nextStatus } from '../../../../src/renderer/src/components/build-web/issue/issue-card-facts'
import { openExternalLink } from '../../platform/external-link'
import { chipTones, colors, radii, spacing, typography } from '../../theme/mobile-theme'
import { loginOf, productLabel, statusLabel } from '../build-web-labels'
import {
  BuildWebToneChip,
  PriorityChip,
  ProductChip,
  StatusChip,
  TypeChip
} from '../BuildWebToneChip'
import { useBuildWebScreen } from '../build-web-screen-context'
import { useOpenBuildWebSession } from '../list/use-open-build-web-session'
import { useTakeToWork } from '../take-to-work/use-take-to-work'
import { CardButton, ui } from './issue-card-ui'
import { blockedBySubtasks } from './IssueSubtasksTab'
import type { IssueArchiveState } from './use-issue-archive'

function EditableTitle({
  detail,
  saving,
  onSave
}: {
  detail: BuildWebIssueDetail
  saving: boolean
  onSave: (patch: BuildWebIssuePatch) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  if (draft === null) {
    return (
      <View style={styles.titleRow}>
        <Text style={styles.title} selectable>
          {detail.title}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Edit the title"
          hitSlop={8}
          onPress={() => setDraft(detail.title)}
        >
          <Pencil size={14} color={colors.textMuted} />
        </Pressable>
      </View>
    )
  }
  const save = () => {
    const next = draft.trim()
    if (next && next !== detail.title) {
      onSave({ title: next })
    }
    setDraft(null)
  }
  return (
    <TextInput
      autoFocus
      value={draft}
      editable={!saving}
      maxLength={500}
      accessibilityLabel="Title"
      onChangeText={setDraft}
      onBlur={save}
      onSubmitEditing={save}
      style={[ui.input, styles.titleInput]}
    />
  )
}

/** An archived or deleted task still opens, from a link or a tab, and says where it is. */
function ArchivedNote({
  detail,
  archive
}: {
  detail: BuildWebIssueDetail
  archive: IssueArchiveState
}) {
  if (detail.deleted_at) {
    return (
      <View style={styles.note}>
        <Text style={ui.body}>
          The task is in the trash. It is taken back in build-web’s Archive section.
        </Text>
      </View>
    )
  }
  if (!detail.archived_at) {
    return null
  }
  return (
    <View style={styles.note}>
      <Text style={[ui.body, ui.grow]}>
        In the archive: put away by {loginOf(detail.archived_by ?? '')} on{' '}
        {new Date(detail.archived_at).toLocaleString()}. It is not in the task list, the AI queue or
        trains.
      </Text>
      <CardButton label="Restore" disabled={archive.busy} onPress={archive.restore} />
    </View>
  )
}

/** The card's head: where it is, what it is, and the moves out of it. */
export function IssueHeader({
  detail,
  saving,
  onSave,
  archive
}: {
  detail: BuildWebIssueDetail
  saving: boolean
  onSave: (patch: BuildWebIssuePatch) => void
  archive: IssueArchiveState
}) {
  const { openIssue, closeIssue } = useBuildWebScreen()
  const takeToWork = useTakeToWork()
  const session = useOpenBuildWebSession()
  const next = nextStatus(detail.status, Boolean(detail.parent_id))
  // The move the open subtasks forbid: build-web answers 409, so the button says so first.
  const blocked = next && next !== 'inprogress' ? blockedBySubtasks(detail) : ''
  return (
    <View style={styles.header}>
      <View style={styles.crumbs}>
        <Text style={styles.crumbLink} onPress={closeIssue} accessibilityRole="link">
          Issues
        </Text>
        <Text style={styles.crumb}>/ {productLabel(detail.product)} /</Text>
        {detail.parent_id && detail.parent_key ? (
          <>
            <Text
              style={[styles.crumbLink, styles.mono]}
              accessibilityRole="link"
              onPress={() => detail.parent_id && openIssue(detail.parent_id)}
            >
              {detail.parent_key}
            </Text>
            <Text style={styles.crumb}>/</Text>
          </>
        ) : null}
        <Text style={[styles.crumb, styles.mono]} selectable>
          {detail.key}
        </Text>
      </View>
      <EditableTitle detail={detail} saving={saving} onSave={onSave} />
      <View style={ui.wrapRow}>
        <StatusChip status={detail.status} />
        <ProductChip product={detail.product} />
        <TypeChip type={detail.type} />
        <PriorityChip priority={detail.priority} />
        {detail.version_name ? (
          <BuildWebToneChip label={detail.version_name} tone={null} mono />
        ) : null}
        {detail.for_ai ? <BuildWebToneChip label="Handed to AI" tone="purple" /> : null}
      </View>
      <Text style={ui.muted}>
        {detail.created_by} · created {new Date(detail.created_at).toLocaleDateString()}
      </Text>
      {detail.agent_session ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open the agent session"
          disabled={session.opening}
          onPress={() => void session.open(detail)}
          style={({ pressed }) => [styles.session, pressed ? styles.pressed : null]}
        >
          <SquareTerminal size={14} color={chipTones.blue} />
          <Text style={styles.sessionText} numberOfLines={1}>
            {detail.agent_session.agent} · {detail.agent_session.worktree_name}
            {detail.agent_session.by ? ` · ${loginOf(detail.agent_session.by)}` : ''}
          </Text>
        </Pressable>
      ) : null}
      <View style={ui.wrapRow}>
        {next ? (
          <CardButton
            variant="primary"
            label={`Move to “${statusLabel(next)}”`}
            disabled={saving || Boolean(blocked)}
            onPress={() => onSave({ status: next })}
          />
        ) : null}
        <CardButton label="Take to work" onPress={() => takeToWork([detail])} />
        <CardButton
          label="Open in build-web"
          icon={ExternalLink}
          onPress={() => openExternalLink(detail.url)}
        />
        {detail.archived_at ? null : (
          <CardButton
            label="Archive"
            icon={Archive}
            disabled={archive.busy}
            onPress={archive.archive}
          />
        )}
      </View>
      {blocked ? <Text style={styles.blocked}>{blocked}</Text> : null}
      <ArchivedNote detail={detail} archive={archive} />
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm
  },
  crumbs: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs },
  crumb: { color: colors.textMuted, fontSize: typography.metaSize },
  crumbLink: { color: colors.textSecondary, fontSize: typography.metaSize, fontWeight: '600' },
  mono: { fontFamily: typography.monoFamily },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  title: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: typography.titleSize,
    fontWeight: '600',
    lineHeight: 24
  },
  titleInput: { fontSize: 16 },
  session: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.borderSubtle
  },
  sessionText: { color: chipTones.blue, fontSize: typography.metaSize, flexShrink: 1 },
  pressed: { opacity: 0.7 },
  blocked: { color: chipTones.amber, fontSize: typography.metaSize },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgRaised
  }
})
