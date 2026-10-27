import { memo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import {
  Bot,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Square,
  SquareTerminal,
  Star
} from 'lucide-react-native'
import type { BuildWebIssueRow } from '../../../../src/shared/build-web-types'
import { chipTones, colors, spacing, typography } from '../../theme/mobile-theme'
import { loginOf } from '../build-web-labels'
import {
  BuildWebToneChip,
  PriorityChip,
  ProductChip,
  StatusChip,
  TypeChip
} from '../BuildWebToneChip'

export type IssueRowField = 'status' | 'priority' | 'assignee'

/** Where a row stands in its family: a task with subtasks on the page, or a subtask under one. */
export type IssueRowFamily = { count: number; under: boolean; open: boolean }

type Props = {
  issue: BuildWebIssueRow
  family: IssueRowFamily
  selecting: boolean
  selected: boolean
  busy: boolean
  onOpen: (issue: BuildWebIssueRow) => void
  onSelect: (issue: BuildWebIssueRow) => void
  onToggleFamily: (issue: BuildWebIssueRow) => void
  onFavorite: (issue: BuildWebIssueRow) => void
  onPick: (issue: BuildWebIssueRow, field: IssueRowField) => void
  onOpenSession: (issue: BuildWebIssueRow) => void
}

/** How many subtasks the task has: amber while one is open, green once all are closed. */
function SubtaskCount({ issue }: { issue: BuildWebIssueRow }) {
  if (issue.children === 0) {
    return null
  }
  const hue = issue.children_open > 0 ? chipTones.amber : chipTones.green
  return (
    <View
      accessibilityLabel={`Subtasks: ${issue.children}, open: ${issue.children_open}`}
      style={[styles.count, { borderColor: `${hue}66`, backgroundColor: `${hue}26` }]}
    >
      <Text style={[styles.countText, { color: hue }]}>{issue.children}</Text>
    </View>
  )
}

/** A tappable chip: the desktop's in-row pickers. */
function PickChip({
  label,
  busy,
  onPress,
  children
}: {
  label: string
  busy: boolean
  onPress: () => void
  children: React.ReactNode
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={busy}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [busy ? styles.busy : null, pressed ? styles.pressed : null]}
    >
      {children}
    </Pressable>
  )
}

function IssueListRowView({
  issue,
  family,
  selecting,
  selected,
  busy,
  onOpen,
  onSelect,
  onToggleFamily,
  onFavorite,
  onPick,
  onOpenSession
}: Props) {
  const FamilyIcon = family.open ? ChevronDown : ChevronRight
  const SelectIcon = selected ? CheckSquare : Square
  return (
    <Pressable
      onPress={() => (selecting ? onSelect(issue) : onOpen(issue))}
      onLongPress={() => onSelect(issue)}
      accessibilityRole="button"
      accessibilityLabel={`${issue.key} ${issue.title}`}
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.row,
        family.under ? styles.under : null,
        selected ? styles.selected : null,
        pressed ? styles.pressed : null
      ]}
    >
      <View style={styles.head}>
        {selecting ? (
          <Pressable
            hitSlop={8}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={`Select ${issue.key}`}
            onPress={() => onSelect(issue)}
          >
            <SelectIcon size={16} color={selected ? colors.textPrimary : colors.textMuted} />
          </Pressable>
        ) : null}
        {!family.under && family.count > 0 ? (
          <Pressable
            hitSlop={8}
            accessibilityRole="button"
            accessibilityState={{ expanded: family.open }}
            accessibilityLabel={
              family.open
                ? `Hide the subtasks of ${issue.key}`
                : `Show ${family.count} subtask(s) of ${issue.key}`
            }
            onPress={() => onToggleFamily(issue)}
          >
            <FamilyIcon size={14} color={colors.textMuted} />
          </Pressable>
        ) : null}
        <Text style={styles.key}>{issue.key}</Text>
        {issue.for_ai ? (
          <Bot size={13} color={chipTones.purple} accessibilityLabel="Handed to AI" />
        ) : null}
        <View style={styles.grow} />
        {issue.agent_session ? (
          <Pressable
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Agent session: ${issue.agent_session.agent} · ${issue.agent_session.worktree_name}`}
            onPress={() => onOpenSession(issue)}
            style={styles.session}
          >
            <SquareTerminal size={13} color={chipTones.blue} />
            <Text style={styles.sessionText} numberOfLines={1}>
              {issue.agent_session.worktree_name}
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          hitSlop={8}
          accessibilityRole="button"
          accessibilityState={{ selected: issue.favorite }}
          accessibilityLabel={`Favorite ${issue.key}`}
          onPress={() => onFavorite(issue)}
        >
          <Star
            size={16}
            color={issue.favorite ? chipTones.amber : colors.textMuted}
            fill={issue.favorite ? chipTones.amber : 'transparent'}
          />
        </Pressable>
      </View>
      <View style={styles.titleLine}>
        <Text style={[styles.title, family.under ? styles.italic : null]} numberOfLines={2}>
          {issue.title}
        </Text>
        <SubtaskCount issue={issue} />
      </View>
      <View style={styles.chips}>
        <PickChip
          label={`Change the status of ${issue.key}`}
          busy={busy}
          onPress={() => onPick(issue, 'status')}
        >
          <StatusChip status={issue.status} />
        </PickChip>
        <PickChip
          label={`Change the priority of ${issue.key}`}
          busy={busy}
          onPress={() => onPick(issue, 'priority')}
        >
          <PriorityChip priority={issue.priority} />
        </PickChip>
        <ProductChip product={issue.product} />
        <TypeChip type={issue.type} />
        {issue.version_name ? (
          <BuildWebToneChip label={issue.version_name} tone={null} mono />
        ) : null}
        <PickChip
          label={`Change the assignee of ${issue.key}`}
          busy={busy}
          onPress={() => onPick(issue, 'assignee')}
        >
          <Text style={styles.assignee} numberOfLines={1}>
            {issue.assignee ? loginOf(issue.assignee) : 'Unassigned'}
          </Text>
        </PickChip>
        {issue.updated_at ? (
          <Text style={styles.date}>{new Date(issue.updated_at).toLocaleDateString()}</Text>
        ) : null}
      </View>
    </Pressable>
  )
}

export const IssueListRow = memo(IssueListRowView)

const styles = StyleSheet.create({
  row: {
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle
  },
  under: { paddingLeft: spacing.md + spacing.xl },
  selected: { backgroundColor: colors.bgRaised },
  pressed: { opacity: 0.7 },
  busy: { opacity: 0.5 },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  key: {
    color: colors.textMuted,
    fontFamily: typography.monoFamily,
    fontSize: typography.metaSize
  },
  grow: { flex: 1 },
  session: { flexDirection: 'row', alignItems: 'center', gap: 3, maxWidth: 140 },
  sessionText: { color: chipTones.blue, fontSize: 11 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: {
    flexShrink: 1,
    color: colors.textPrimary,
    fontSize: typography.bodySize,
    lineHeight: 19
  },
  italic: { fontStyle: 'italic' },
  count: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  countText: { fontSize: 10, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs + 2 },
  assignee: { color: colors.textSecondary, fontSize: typography.metaSize, maxWidth: 120 },
  date: { color: colors.textMuted, fontSize: 11 }
})
