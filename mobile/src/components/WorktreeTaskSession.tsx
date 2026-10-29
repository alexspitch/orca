import {
  CircleAlert,
  CircleDashed,
  Hourglass,
  List,
  MessageCircleQuestion,
  Timer
} from 'lucide-react-native'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import {
  BUILD_WEB_SESSION_STATE_LABELS,
  fillSessionLabel,
  sessionAttentionPhrases
} from '../../../src/shared/build-web-session-labels'
import {
  getTaskGroupFromLaneKey,
  getWorktreeTaskSessionState
} from '../../../src/shared/sidebar-list/task-session-groups'
import { colors, typography } from '../theme/mobile-theme'
import type { Worktree } from '../worktree/workspace-list-types'

// IS-147: a task worktree's number before its title and its session state at the row's right,
// worded as the desktop words them. The agent indicator on the left stays the agent's.

type TaskRow = Pick<Worktree, 'buildWebTask' | 'buildWebSession'>

// Why read loosely: worktree.ps rows are unchecked wire data, and a newer host may add reasons.
// The phone's rows carry no base branch, so commits read «2 unmerged commits».
function attentionPhrases(row: TaskRow) {
  const detail = row.buildWebSession?.detail
  return sessionAttentionPhrases({
    reason: row.buildWebSession?.reason,
    detail: typeof detail === 'string' ? detail : null
  })
}

function attentionShortText(row: TaskRow): string | null {
  const phrases = attentionPhrases(row)
  return phrases ? fillSessionLabel(phrases.short) : null
}

function taskKey(row: TaskRow): string | null {
  const key = row.buildWebTask?.key
  return typeof key === 'string' && key !== '' ? key : null
}

/** The sentence for an attention row: its reason with the host's detail, worded as the desktop's. */
export function describeTaskAttention(row: TaskRow): string | null {
  if (getWorktreeTaskSessionState(row) !== 'attention') {
    return null
  }
  const phrases = attentionPhrases(row)
  return phrases
    ? fillSessionLabel(phrases.full)
    : BUILD_WEB_SESSION_STATE_LABELS.attention.full.text
}

export function WorktreeTaskKey({ row }: { row: TaskRow }) {
  const key = taskKey(row)
  return key ? (
    <Text style={styles.key} numberOfLines={1}>
      {key}
    </Text>
  ) : null
}

/** Waiting and closing in words; attention as its short reason, in the warning tone. */
export function WorktreeTaskSessionChip({ row }: { row: TaskRow }) {
  const state = getWorktreeTaskSessionState(row)
  if (!state || state === 'active') {
    return null
  }
  const attention = state === 'attention'
  const labels = BUILD_WEB_SESSION_STATE_LABELS[state]
  const text = attention
    ? (attentionShortText(row) ?? labels.short?.text ?? labels.full.text)
    : labels.full.text
  const Icon = attention ? CircleAlert : state === 'waiting' ? Timer : Hourglass
  const color = attention ? colors.statusAmber : colors.textMuted
  return (
    <View style={styles.chip} accessibilityLabel={describeTaskAttention(row) ?? labels.full.text}>
      <Icon size={12} color={color} />
      <Text style={[styles.chipText, { color }]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  )
}

/** The reason under a row in Needs attention, where the row's chip would repeat it. */
export function WorktreeTaskAttentionReason({ row }: { row: TaskRow }) {
  const text = describeTaskAttention(row)
  return text ? (
    <View style={styles.reason}>
      <CircleAlert size={12} color={colors.statusAmber} style={styles.reasonIcon} />
      <Text style={styles.reasonText}>{text}</Text>
    </View>
  ) : null
}

/** A «By task» lane header's icon, as the desktop's; Needs attention in the warning tone. */
export function TaskLaneIcon(props: { sectionKey: string; style?: StyleProp<ViewStyle> }) {
  const icon = { size: 12, color: colors.textMuted, style: props.style }
  // Why a switch, not a table: a module-level read of the icons breaks suites that mock a few.
  switch (getTaskGroupFromLaneKey(props.sectionKey)) {
    case 'attention':
      return <CircleAlert {...icon} color={colors.statusAmber} />
    case 'input':
      // The agent indicator's «needs input» colour.
      return <MessageCircleQuestion {...icon} color={colors.statusRed} />
    case 'release':
      return <Timer {...icon} />
    case 'progress':
      return <List {...icon} />
    case 'none':
      return <CircleDashed {...icon} />
    case null:
      return null
  }
}

const styles = StyleSheet.create({
  key: {
    flexShrink: 0,
    fontFamily: typography.monoFamily,
    fontSize: 13,
    fontWeight: '500',
    color: colors.textPrimary
  },
  chip: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3
  },
  chipText: {
    fontSize: 11
  },
  reason: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    marginTop: 2
  },
  reasonIcon: {
    marginTop: 2
  },
  reasonText: {
    flex: 1,
    fontSize: typography.metaSize,
    color: colors.textSecondary
  }
})
